import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMetaSignature, readBodyWithLimit } from "@/lib/webhooks/verify";
import {
  sendWhatsAppText,
  sendWhatsAppAttachmentsByIds,
  fetchWhatsAppMediaBytes,
  type WhatsAppCreds,
} from "@/lib/channels/whatsapp";
import {
  handleInboundMessage,
  recordUnhandledInboundMessage,
  recordInboundImageMessage,
  handleInboundVoiceMessage,
  findOrCreateOrderForInbound,
} from "@/lib/webhooks/inbound";
import { inboundMimeToType, INBOUND_ATTACHMENT_MAX_BYTES } from "@/lib/inbound-attachments";
import { inboundAudioMimeOk } from "@/lib/ai/transcribe";

// Meta's one-time webhook verification handshake (configured in the Meta App
// dashboard). No auth needed — it's just proving we control this URL.
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

interface WhatsAppMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type?: string; caption?: string };
  audio?: { id: string; mime_type?: string; voice?: boolean };
  voice?: { id: string; mime_type?: string };
}

interface WhatsAppChangeValue {
  metadata?: { phone_number_id?: string };
  messages?: WhatsAppMessage[];
}

// Meta always expects a fast 200 — it retries deliveries aggressively on any
// non-200 or slow response, which would otherwise cause duplicate processing.
// Every step below is wrapped so one bad message never blocks that response.
export async function POST(req: Request) {
  const rawBody = await readBodyWithLimit(req);
  if (rawBody === null) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  if (!verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { entry?: { changes?: { value?: WhatsAppChangeValue }[] }[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages?.length) continue; // delivery/read status callbacks, not messages

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      // Multi-tenant routing: the phone_number_id in the payload identifies
      // whose WhatsApp this is. Tokens are per-tenant, from their connection.
      const connection = await prisma.channelConnection.findUnique({
        where: { channel_externalId: { channel: "WHATSAPP", externalId: phoneNumberId } },
        include: { profile: true },
      });
      if (!connection || !connection.isActive) {
        console.error("[whatsapp webhook] no active connection for phone_number_id", phoneNumberId);
        continue;
      }
      const profile = connection.profile;
      const creds: WhatsAppCreds = { phoneNumberId, accessToken: connection.accessToken };

      for (const message of value.messages) {
        try {
          if (message.type === "image" && message.image?.id) {
            const media = await fetchWhatsAppMediaBytes(creds, message.image.id);
            const fileType = media ? inboundMimeToType(media.mimeType) : null;
            if (media && fileType && media.data.length <= INBOUND_ATTACHMENT_MAX_BYTES) {
              const attachment = await prisma.inboundAttachment.create({
                data: {
                  profileId: profile.id,
                  fileName: `whatsapp-${message.id}`,
                  fileType,
                  mimeType: media.mimeType,
                  data: media.data,
                  sizeBytes: media.data.length,
                },
              });
              const order = await findOrCreateOrderForInbound(profile, "WHATSAPP", message.from);
              const result = await recordInboundImageMessage({
                profile,
                order,
                inboundAttachmentId: attachment.id,
                externalMessageId: message.id,
                caption: message.image.caption,
              });
              if (result?.ackReply) await sendWhatsAppText(creds, message.from, result.ackReply);
              continue;
            }
            // Download or validation failed — fall through to the generic
            // unsupported-message handling below (never worse than before).
          }

          // Voice notes (audio / voice message types) — transcribe + sell.
          const audioMedia = message.audio ?? message.voice;
          if ((message.type === "audio" || message.type === "voice") && audioMedia?.id) {
            const media = await fetchWhatsAppMediaBytes(creds, audioMedia.id);
            if (media && inboundAudioMimeOk(media.mimeType) && media.data.length <= INBOUND_ATTACHMENT_MAX_BYTES) {
              const result = await handleInboundVoiceMessage({
                profile,
                source: "WHATSAPP",
                externalContactId: message.from,
                externalMessageId: message.id,
                audioData: media.data,
                mimeType: media.mimeType,
              });
              if (result?.reply) {
                await sendWhatsAppText(creds, message.from, result.reply);
                if (result.attachmentIds.length) await sendWhatsAppAttachmentsByIds(creds, message.from, result.attachmentIds);
              }
              continue;
            }
            // Download/validation failed — fall through to generic handling.
          }

          if (message.type !== "text" || !message.text?.body) {
            await recordUnhandledInboundMessage({
              profile,
              source: "WHATSAPP",
              externalContactId: message.from,
              externalMessageId: message.id,
              note: `Customer sent an unsupported message type (${message.type}) — needs a human reply.`,
            });
            continue;
          }

          const result = await handleInboundMessage({
            profile,
            source: "WHATSAPP",
            externalContactId: message.from,
            externalMessageId: message.id,
            customerMessage: message.text.body,
          });
          if (!result) continue;

          await sendWhatsAppText(creds, message.from, result.reply);
          if (result.attachmentIds.length) {
            await sendWhatsAppAttachmentsByIds(creds, message.from, result.attachmentIds);
          }
        } catch (err) {
          console.error("[whatsapp webhook] failed to process message", message.id, err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
