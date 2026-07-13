import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { generateGcReply, recordExchange, refreshOrderSummary, scheduleFollowUp } from "@/lib/ai/engine";
import { transcribeAudio, inboundAudioMimeOk, transcribeConfigured } from "@/lib/ai/transcribe";
import { INBOUND_ATTACHMENT_MAX_BYTES } from "@/lib/inbound-attachments";

// Playground: simulate a customer sending a WhatsApp voice note. Transcribes
// the uploaded audio and runs the full sales engine on the transcript, so you
// can test voice selling without a live channel.
export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const form = await req.formData();
    const orderId = form.get("orderId");
    const file = form.get("file");

    if (typeof orderId !== "string" || !(file instanceof File)) {
      throw new ApiError(400, "orderId and audio file are required");
    }
    if (!inboundAudioMimeOk(file.type)) throw new ApiError(400, `Unsupported audio type: ${file.type}`);
    if (file.size > INBOUND_ATTACHMENT_MAX_BYTES) throw new ApiError(413, "Audio too large (max 5MB)");

    const order = await prisma.order.findFirst({
      where: { id: orderId, profileId: profile.id },
      include: { conversation: true },
    });
    if (!order || !order.conversation) throw new ApiError(404, "Session not found");
    const conversationId = order.conversation.id;

    const data = new Uint8Array(await file.arrayBuffer()) as Uint8Array<ArrayBuffer>;
    const attachment = await prisma.inboundAttachment.create({
      data: {
        profileId: profile.id,
        fileName: file.name || "voice.ogg",
        fileType: "AUDIO",
        mimeType: file.type,
        data,
        sizeBytes: data.length,
      },
    });

    const transcript = await transcribeAudio({ data, mimeType: file.type, fileName: attachment.fileName });

    await prisma.message.create({
      data: {
        conversationId,
        role: "CUSTOMER",
        content: transcript || "[Voice note]",
        inboundAttachmentIds: JSON.stringify([attachment.id]),
      },
    });

    if (!transcript) {
      return {
        transcript: null,
        transcribeConfigured: transcribeConfigured(),
        reply: null,
        note: transcribeConfigured()
          ? "Transcription failed for this audio."
          : "Transcription not configured — set TRANSCRIBE_API_KEY (or OPENAI_API_KEY). On a real channel this hands off to a human.",
      };
    }

    if (order.needsHuman) {
      return { transcript, reply: null, needsHuman: true };
    }

    const fresh = await prisma.order.findUnique({ where: { id: order.id } });
    const { output, order: updated, attachmentIds } = await generateGcReply({
      profile,
      order: fresh!,
      conversationId,
      customerMessage: null,
    });
    await recordExchange({ conversationId, customerMessage: null, output, attachmentIds });
    await scheduleFollowUp(profile, updated, { customerSpoke: true });
    refreshOrderSummary(profile, updated, conversationId).catch(() => {});

    return { transcript, reply: output.reply, attachmentIds };
  });
}
