import type { Conversation, Order, StoreProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  generateGcReply,
  recordExchange,
  refreshOrderSummary,
  scheduleFollowUp,
} from "@/lib/ai/engine";
import type { OrderSource } from "@/lib/constants";
import { parseJson, toJson } from "@/lib/json";
import { FulfillmentBrainSchema } from "@/lib/ai/schemas";
import { verifyPaymentProof, isConfidentPaymentMatch } from "@/lib/ai/vision";
import { confirmPayment } from "@/lib/orders/confirm-payment";
import { transcribeAudio } from "@/lib/ai/transcribe";

type OrderWithConversation = Order & { conversation: Conversation | null };

// Shared by handleInboundMessage and the image-message path below — find the
// order for this channel contact (or create one), and make sure it has a
// conversation to write into.
export async function findOrCreateOrderForInbound(
  profile: StoreProfile,
  source: OrderSource,
  externalContactId: string
): Promise<OrderWithConversation> {
  let order = await prisma.order.findFirst({
    where: { profileId: profile.id, externalContactId, source },
    include: { conversation: true },
  });
  if (!order) {
    order = await prisma.order.create({
      data: {
        profileId: profile.id,
        externalContactId,
        phone: source === "WHATSAPP" ? externalContactId : null,
        source,
        conversation: { create: { profileId: profile.id, kind: source } },
      },
      include: { conversation: true },
    });
  }
  if (!order.conversation) {
    order = {
      ...order,
      conversation: await prisma.conversation.create({
        data: { profileId: profile.id, kind: source, orderId: order.id },
      }),
    };
  }
  return order;
}

// Channel-agnostic core: WhatsApp/Messenger/Instagram adapters all call this.
// Runs the exact same generateGcReply/recordExchange pipeline Playground uses
// — a new channel is a new adapter, not a new sales brain.
export async function handleInboundMessage(opts: {
  profile: StoreProfile;
  source: OrderSource;
  externalContactId: string; // wa_id / PSID / IGSID
  externalMessageId: string; // wamid / mid — used for dedupe
  customerMessage: string;
}): Promise<{ reply: string; attachmentIds: string[] } | null> {
  const { profile, source, externalContactId, externalMessageId, customerMessage } = opts;

  // Meta redelivers webhook events aggressively; never process the same
  // message twice (would double-reply and duplicate the conversation).
  const already = await prisma.message.findUnique({ where: { externalId: externalMessageId } });
  if (already) return null;

  const order = await findOrCreateOrderForInbound(profile, source, externalContactId);
  const conversationId = order.conversation!.id;

  // Agent has taken over — record the inbound message so the CRM
  // conversation stays complete, but GC stays silent (same guardrail
  // generateGcReply itself enforces for every other channel).
  if (order.needsHuman) {
    await prisma.message.create({
      data: { conversationId, role: "CUSTOMER", content: customerMessage, externalId: externalMessageId },
    });
    return null;
  }

  const { output, order: updatedOrder, attachmentIds } = await generateGcReply({
    profile,
    order,
    conversationId,
    customerMessage,
  });

  await recordExchange({ conversationId, customerMessage, output, attachmentIds, externalMessageId });
  await scheduleFollowUp(profile, updatedOrder, { customerSpoke: true });

  refreshOrderSummary(profile, updatedOrder, conversationId).catch(() => {});

  return { reply: output.reply, attachmentIds };
}

// A customer-sent image (usually proof of payment) never reaches the sales
// LLM — it's handled deterministically. Stores the image reference on the
// message, hands the order to the agent, and returns a short static
// acknowledgment (not AI-generated) so the customer isn't left with silence.
export async function recordInboundImageMessage(opts: {
  profile: StoreProfile;
  order: OrderWithConversation;
  inboundAttachmentId: string;
  externalMessageId?: string;
  caption?: string; // text sent alongside the image in the same message, if any
}): Promise<{ ackReply: string } | null> {
  const { profile, inboundAttachmentId, externalMessageId, caption } = opts;
  let { order } = opts;

  if (externalMessageId) {
    const already = await prisma.message.findUnique({ where: { externalId: externalMessageId } });
    if (already) return null;
  }

  if (!order.conversation) {
    order = {
      ...order,
      conversation: await prisma.conversation.create({
        data: { profileId: profile.id, kind: order.source as OrderSource, orderId: order.id },
      }),
    };
  }
  const conversationId = order.conversation!.id;

  await prisma.message.create({
    data: {
      conversationId,
      role: "CUSTOMER",
      content: caption?.trim() || "[Image attached]",
      inboundAttachmentIds: JSON.stringify([inboundAttachmentId]),
      externalId: externalMessageId,
    },
  });

  // Already mid-review — record the extra image but don't repeat the ack.
  if (order.needsHuman) return null;

  // Opt-in, high-risk exception to the "AI cannot set money states" rule —
  // see src/lib/ai/vision.ts and src/lib/orders/confirm-payment.ts. Only
  // engages when the agent has explicitly turned this on AND the order has an
  // exact expected total; the vision model itself never touches the DB, it
  // only returns a verdict that's checked against fixed thresholds (including
  // the hard amount match) in plain code.
  if (profile.autoConfirmPayments) {
    const verification = await verifyAndMaybeConfirm(profile, order, inboundAttachmentId, conversationId);
    if (verification) return verification;
  }

  const agent = profile.agentName || "the team";
  const ackReply = `Thanks for sending this! I've forwarded it to ${agent} to verify — they'll confirm your order shortly 😊`;

  await prisma.order.update({
    where: { id: order.id },
    data: {
      needsHuman: true,
      // Money states survive: if this order was somehow already paid, don't
      // demote it — same both-branches protection as applyEngineEffects.
      ...(order.paymentStatus === "CONFIRMED" ? {} : { status: "Human Takeover Needed", paymentStatus: "PENDING_CONFIRMATION" }),
      takeoverReason: "Customer sent an image (likely proof of payment) — review it in this order's conversation.",
      nextFollowUpAt: null,
    },
  });

  await prisma.message.create({
    data: { conversationId, role: "GC", content: ackReply },
  });

  return { ackReply };
}

// Best-effort: any failure (vision call errors, low confidence, recipient or
// amount mismatch) returns null so the caller falls through to the normal
// human-handoff path.
async function verifyAndMaybeConfirm(
  profile: StoreProfile,
  order: Order,
  inboundAttachmentId: string,
  conversationId: string
): Promise<{ ackReply: string } | null> {
  try {
    const attachment = await prisma.inboundAttachment.findUnique({ where: { id: inboundAttachmentId } });
    if (!attachment) return null;

    const fulfillment = FulfillmentBrainSchema.parse(parseJson(profile.fulfillmentBrain, {}));
    const verification = await verifyPaymentProof({
      imageData: attachment.data,
      mimeType: attachment.mimeType,
      paymentMethods: fulfillment.paymentMethods || "",
      paymentInstructions: fulfillment.paymentInstructions || "",
      expectedAmountMyr: order.totalMyr,
    });
    if (!verification || !isConfidentPaymentMatch(verification, order.totalMyr)) return null;

    const updatedOrder = await confirmPayment(profile, order);
    const addressFollowUp = !order.deliveryAddress
      ? " Could you share your delivery address so we can ship it right out? 📦"
      : " We'll pack and ship your order within 1-3 working days 📦";
    const ackReply = `Payment verified! ✅ RM${verification.extractedAmount} received — your order is confirmed 🎉${addressFollowUp}`;

    await prisma.message.create({
      data: {
        conversationId,
        role: "GC",
        content: ackReply,
        // Full verdict stored for audit — never confirm-and-forget.
        meta: toJson({ paymentVerification: verification, orderStatus: updatedOrder.status, expectedAmountMyr: order.totalMyr }),
      },
    });

    return { ackReply };
  } catch (err) {
    console.error("[vision] auto-confirm failed (non-fatal, falling back to human review)", err);
    return null;
  }
}

// A customer-sent VOICE NOTE — extremely common in Malaysian WhatsApp
// selling. We store the audio, transcribe it (Whisper), and then run the full
// sales engine on the transcript exactly as if the customer had typed it. If
// transcription isn't configured or fails, we gracefully hand to a human
// rather than dropping the customer (same "when unsure, hand over" rule).
export async function handleInboundVoiceMessage(opts: {
  profile: StoreProfile;
  source: OrderSource;
  externalContactId: string;
  externalMessageId: string;
  audioData: Uint8Array<ArrayBuffer>;
  mimeType: string;
}): Promise<{ reply: string; attachmentIds: string[] } | null> {
  const { profile, source, externalContactId, externalMessageId, audioData, mimeType } = opts;

  const already = await prisma.message.findUnique({ where: { externalId: externalMessageId } });
  if (already) return null;

  const order = await findOrCreateOrderForInbound(profile, source, externalContactId);
  const conversationId = order.conversation!.id;

  // Store the audio so the CRM keeps a playable record.
  const attachment = await prisma.inboundAttachment.create({
    data: {
      profileId: profile.id,
      fileName: `voice-${externalMessageId}`,
      fileType: "AUDIO",
      mimeType,
      data: audioData,
      sizeBytes: audioData.length,
    },
  });

  const transcript = await transcribeAudio({ data: audioData, mimeType, fileName: attachment.fileName });

  // Record the customer's voice message (transcript as content so GC and the
  // CRM read it naturally; the AUDIO attachment marks it as a voice note).
  await prisma.message.create({
    data: {
      conversationId,
      role: "CUSTOMER",
      content: transcript || "[Voice note]",
      inboundAttachmentIds: JSON.stringify([attachment.id]),
      externalId: externalMessageId,
    },
  });

  // Agent has taken over — record silently, no auto-reply.
  if (order.needsHuman) return null;

  // Couldn't transcribe (not configured / failed) → warm human hand-off.
  if (!transcript) {
    const agent = profile.agentName || "the team";
    const ackReply = `Got your voice message 🎧 — let me get ${agent} to listen and reply properly, one moment 😊`;
    await prisma.order.update({
      where: { id: order.id },
      data: {
        needsHuman: true,
        ...(order.paymentStatus === "CONFIRMED" ? {} : { status: "Human Takeover Needed" }),
        takeoverReason: "Customer sent a voice note that couldn't be transcribed — listen to it in this conversation.",
        nextFollowUpAt: null,
      },
    });
    await prisma.message.create({ data: { conversationId, role: "GC", content: ackReply } });
    return { reply: ackReply, attachmentIds: [] };
  }

  // Transcribed → run the full sales engine on the transcript. The customer
  // message is already stored, so we reply "to the conversation as it stands"
  // (customerMessage: null), same pattern as the release-resume flow.
  const freshOrder = await prisma.order.findUnique({ where: { id: order.id } });
  const { output, order: updated, attachmentIds } = await generateGcReply({
    profile,
    order: freshOrder!,
    conversationId,
    customerMessage: null,
  });
  await recordExchange({ conversationId, customerMessage: null, output, attachmentIds });
  await scheduleFollowUp(profile, updated, { customerSpoke: true });
  refreshOrderSummary(profile, updated, conversationId).catch(() => {});

  return { reply: output.reply, attachmentIds };
}

// Records an inbound message the app can't confidently auto-handle (e.g. a
// sticker) and hands the order to the agent rather than
// guessing — same "when unsure, hand over" philosophy as the sales prompt.
export async function recordUnhandledInboundMessage(opts: {
  profile: StoreProfile;
  source: OrderSource;
  externalContactId: string;
  externalMessageId: string;
  note: string;
}): Promise<void> {
  const { profile, source, externalContactId, externalMessageId, note } = opts;

  const already = await prisma.message.findUnique({ where: { externalId: externalMessageId } });
  if (already) return;

  let order = await prisma.order.findFirst({
    where: { profileId: profile.id, externalContactId, source },
  });
  if (!order) {
    order = await prisma.order.create({
      data: {
        profileId: profile.id,
        externalContactId,
        source,
        needsHuman: true,
        takeoverReason: note,
        status: "Human Takeover Needed",
        conversation: { create: { profileId: profile.id, kind: source } },
      },
    });
  } else {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        needsHuman: true,
        takeoverReason: note,
        // Same money-state protection as everywhere else.
        ...(order.paymentStatus === "CONFIRMED" ? {} : { status: "Human Takeover Needed" }),
      },
    });
  }

  const conversation =
    (await prisma.conversation.findFirst({ where: { orderId: order.id } })) ??
    (await prisma.conversation.create({ data: { profileId: profile.id, kind: source, orderId: order.id } }));

  await prisma.message.create({
    data: { conversationId: conversation.id, role: "SYSTEM", content: note, externalId: externalMessageId },
  });
}
