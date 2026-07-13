import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMetaSignature, readBodyWithLimit } from "@/lib/webhooks/verify";
import {
  sendMetaText,
  sendMetaAttachmentsByIds,
  fetchMetaMediaBytes,
  type MetaMessagingCreds,
} from "@/lib/channels/meta-messaging";
import {
  handleInboundMessage,
  recordUnhandledInboundMessage,
  recordInboundImageMessage,
  handleInboundVoiceMessage,
  findOrCreateOrderForInbound,
} from "@/lib/webhooks/inbound";
import { inboundMimeToType, INBOUND_ATTACHMENT_MAX_BYTES } from "@/lib/inbound-attachments";
import { inboundAudioMimeOk } from "@/lib/ai/transcribe";
import type { OrderSource } from "@/lib/constants";

// One webhook route for both Facebook Messenger ("page" object) and
// Instagram DM ("instagram" object) — Meta sends both shapes here with the
// same envelope: entry[].messaging[] events addressed to a page/IG id.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

interface MessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: { type?: string; payload?: { url?: string } }[];
  };
}

interface MetaEntry {
  id?: string; // page id (Messenger) or IG business account id (Instagram)
  messaging?: MessagingEvent[];
}

export async function POST(req: Request) {
  const rawBody = await readBodyWithLimit(req);
  if (rawBody === null) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  if (!verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { object?: string; entry?: MetaEntry[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const source: OrderSource | null =
    payload.object === "page" ? "MESSENGER" : payload.object === "instagram" ? "INSTAGRAM" : null;
  if (!source) return NextResponse.json({ ok: true });
  const channel = source; // ChannelConnection.channel uses the same values

  for (const entry of payload.entry ?? []) {
    const targetId = entry.id;
    if (!targetId || !entry.messaging?.length) continue;

    const connection = await prisma.channelConnection.findUnique({
      where: { channel_externalId: { channel, externalId: targetId } },
      include: { profile: true },
    });
    if (!connection || !connection.isActive) {
      console.error(`[meta webhook] no active ${channel} connection for id`, targetId);
      continue;
    }
    const profile = connection.profile;
    // The Send API always posts to the *page*; for Instagram the page id is
    // stored as displayName-side metadata — but Meta accepts the IG entry id
    // with the page token for IG messaging via /{ig-id}/messages too. We use
    // the connection's externalId, which is what this entry was addressed to.
    const creds: MetaMessagingCreds = { pageId: connection.externalId, accessToken: connection.accessToken };

    for (const event of entry.messaging) {
      const senderId = event.sender?.id;
      const message = event.message;
      if (!senderId || !message?.mid) continue;
      // Echoes of our own outbound messages come back through the webhook —
      // never treat them as customer input.
      if (message.is_echo) continue;
      // The page/IG account itself can appear as sender on some event types.
      if (senderId === targetId) continue;

      try {
        // Voice note (audio attachment) — transcribe + sell.
        const audioAttachment = message.attachments?.find((a) => a.type === "audio" && a.payload?.url);
        if (audioAttachment?.payload?.url) {
          const media = await fetchMetaMediaBytes(audioAttachment.payload.url);
          if (media && inboundAudioMimeOk(media.mimeType) && media.data.length <= INBOUND_ATTACHMENT_MAX_BYTES) {
            const result = await handleInboundVoiceMessage({
              profile,
              source,
              externalContactId: senderId,
              externalMessageId: message.mid,
              audioData: media.data,
              mimeType: media.mimeType,
            });
            if (result?.reply) {
              await sendMetaText(creds, senderId, result.reply);
              if (result.attachmentIds.length) await sendMetaAttachmentsByIds(creds, senderId, result.attachmentIds);
            }
            continue;
          }
        }

        const imageAttachment = message.attachments?.find(
          (a) => a.type === "image" && a.payload?.url
        );
        if (imageAttachment?.payload?.url) {
          const media = await fetchMetaMediaBytes(imageAttachment.payload.url);
          const fileType = media ? inboundMimeToType(media.mimeType) : null;
          if (media && fileType && media.data.length <= INBOUND_ATTACHMENT_MAX_BYTES) {
            const attachment = await prisma.inboundAttachment.create({
              data: {
                profileId: profile.id,
                fileName: `${channel.toLowerCase()}-${message.mid}`,
                fileType,
                mimeType: media.mimeType,
                data: media.data,
                sizeBytes: media.data.length,
              },
            });
            const order = await findOrCreateOrderForInbound(profile, source, senderId);
            const result = await recordInboundImageMessage({
              profile,
              order,
              inboundAttachmentId: attachment.id,
              externalMessageId: message.mid,
              caption: message.text,
            });
            if (result?.ackReply) await sendMetaText(creds, senderId, result.ackReply);
            continue;
          }
        }

        if (!message.text) {
          await recordUnhandledInboundMessage({
            profile,
            source,
            externalContactId: senderId,
            externalMessageId: message.mid,
            note: "Customer sent an unsupported message type — needs a human reply.",
          });
          continue;
        }

        const result = await handleInboundMessage({
          profile,
          source,
          externalContactId: senderId,
          externalMessageId: message.mid,
          customerMessage: message.text,
        });
        if (!result) continue;

        await sendMetaText(creds, senderId, result.reply);
        if (result.attachmentIds.length) {
          await sendMetaAttachmentsByIds(creds, senderId, result.attachmentIds);
        }
      } catch (err) {
        console.error(`[meta webhook] failed to process ${channel} message`, message.mid, err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
