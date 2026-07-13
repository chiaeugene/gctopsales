import type { Order, StoreProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseJson, toJson } from "@/lib/json";
import { chatComplete, extractJson, llmConfigured, type ChatMessage } from "@/lib/ai/llm";
import { buildGcSystemPrompt } from "@/lib/ai/prompts";
import { EngineOutputSchema, type EngineOutput } from "@/lib/ai/schemas";
import { AI_ALLOWED_STATUSES, MONEY_STATES, type OrderStatus } from "@/lib/constants";
import { TESTIMONIAL_PHOTO_PREFIX } from "@/lib/attachments";

const HISTORY_LIMIT = 40;

export class LlmNotConfiguredError extends Error {
  constructor() {
    super("LLM not configured");
    this.name = "LlmNotConfiguredError";
  }
}

// Full auto-reply pipeline: load tenant brains → compile prompt → call LLM →
// parse output contract → apply guarded side effects (facts, cart, status,
// takeover). Used by the playground, every channel webhook, and the
// follow-up scheduler.
// customerMessage: null means "reply to the conversation as it stands" — used
// when the agent hands an order back to GC, or the follow-up scheduler fires.
export async function generateGcReply(opts: {
  profile: StoreProfile;
  order: Order;
  conversationId: string;
  customerMessage: string | null;
  // Extra system-side instruction appended as the final user turn (e.g. the
  // follow-up nudge). Never stored as a customer message.
  systemNudge?: string;
}): Promise<{ reply: string; output: EngineOutput; order: Order; attachmentIds: string[] }> {
  const { profile, order, conversationId, customerMessage, systemNudge } = opts;

  if (!llmConfigured()) throw new LlmNotConfiguredError();

  // Frozen orders never auto-reply — the agent has taken over.
  if (order.needsHuman) {
    throw new Error("Order is in human takeover; GC will not auto-reply.");
  }

  const [products, trainingExamples, testimonials, history] = await Promise.all([
    prisma.product.findMany({
      where: { profileId: profile.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      // Metadata only — the prompt/guardrail just need ids/labels, never the
      // bytes. Loading every attachment's file payload on every chat message
      // OOM-crashes the server (learned in production).
      include: { attachments: { orderBy: { sortOrder: "asc" }, omit: { data: true } } },
    }),
    prisma.trainingExample.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.testimonial.findMany({
      where: { profileId: profile.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 40,
      // Metadata only — photoMimeType just tells us a photo exists; the
      // bytes are never loaded here (same OOM discipline as attachments).
      omit: { photoData: true },
    }),
    prisma.message.findMany({
      where: { conversationId },
      // Customer + reply rows are written in one transaction and share a
      // timestamp — id (creation-ordered cuid) breaks the tie.
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: HISTORY_LIMIT,
    }),
  ]);

  const system = buildGcSystemPrompt({ profile, products, trainingExamples, testimonials, order });

  const messages: ChatMessage[] = [];
  for (const m of history) {
    if (m.role !== "CUSTOMER" && m.role !== "GC" && m.role !== "AGENT") continue;
    const role = m.role === "CUSTOMER" ? ("user" as const) : ("assistant" as const);
    const last = messages[messages.length - 1];
    // Consecutive same-role turns happen when customer messages pile up during
    // a human takeover — merge them so the API sees clean alternation.
    if (last && last.role === role) last.content += `\n${m.content}`;
    else messages.push({ role, content: m.content });
  }
  if (customerMessage !== null) {
    const last = messages[messages.length - 1];
    if (last && last.role === "user") last.content += `\n${customerMessage}`;
    else messages.push({ role: "user", content: customerMessage });
  }
  if (systemNudge) {
    const last = messages[messages.length - 1];
    if (last && last.role === "user") last.content += `\n\n${systemNudge}`;
    else messages.push({ role: "user", content: systemNudge });
  }
  if (messages.length === 0) {
    messages.push({ role: "user", content: "SYSTEM: Open this conversation with a warm greeting appropriate to the store. Output the mandatory JSON contract." });
  }

  const raw = await chatComplete({ system, messages, maxTokens: 4000, temperature: 0.7 });

  let parsed = EngineOutputSchema.safeParse(extractJson(raw));
  if (!parsed.success) {
    // Contract violation (plain prose instead of JSON). Retry once with the
    // bad output shown back and a pointed correction — this recovers nearly
    // all cases without punishing the conversation with a takeover.
    const retryRaw = await chatComplete({
      system,
      messages: [
        ...messages,
        { role: "assistant", content: raw },
        {
          role: "user",
          content:
            "SYSTEM: Your previous response was not the required JSON object, so it could NOT be delivered to the customer. Re-send that same reply now as ONE valid JSON object exactly matching the mandatory output contract — no other text.",
        },
      ],
      maxTokens: 4000,
      temperature: 0.3,
    });
    parsed = EngineOutputSchema.safeParse(extractJson(retryRaw));
    if (parsed.success) console.error("[engine] JSON contract violated once; retry succeeded.");
  }

  const output: EngineOutput = parsed.success
    ? parsed.data
    : // Still broken after retry → degrade gracefully: use raw text, flag low confidence.
      {
        reply: raw.trim() || "Sorry, give me a moment! 😊",
        detectedLanguage: "en",
        extracted: {},
        proposedOrder: null,
        suggestedStatus: null,
        takeover: { needed: false, reason: null },
        confidence: 0.3,
        sendAttachmentIds: [],
      };
  if (!parsed.success) console.error("[engine] JSON contract violated twice; falling back to raw text + takeover.");

  // Guardrail: only allow attachment ids that actually belong to this
  // tenant's active products or active testimonials with a photo — the model
  // can never reference another tenant's files or an id it invented.
  const validAttachmentIds = new Set([
    ...products.flatMap((p) => p.attachments.map((a) => a.id)),
    ...testimonials.filter((t) => t.photoMimeType).map((t) => `${TESTIMONIAL_PHOTO_PREFIX}${t.id}`),
  ]);
  const attachmentIds = output.sendAttachmentIds.filter((id) => validAttachmentIds.has(id));

  const updatedOrder = await applyEngineEffects(profile, order, output);
  return { reply: output.reply, output, order: updatedOrder, attachmentIds };
}

// Server-side guardrail layer: the model only *suggests*; we decide what applies.
// Exported for behavioral tests — production callers go through generateGcReply.
export async function applyEngineEffects(
  profile: StoreProfile,
  order: Order,
  output: EngineOutput
): Promise<Order> {
  const data: Record<string, unknown> = {};
  const ex = output.extracted ?? {};

  // Fill order facts (only overwrite blanks — the agent's manual edits win).
  if (ex.customerName && !order.customerName) data.customerName = ex.customerName;
  if (ex.phone && !order.phone) data.phone = ex.phone;
  if (ex.deliveryAddress && !order.deliveryAddress) data.deliveryAddress = ex.deliveryAddress;
  if (ex.segment && !order.segment) data.segment = ex.segment;
  if (ex.productInterest && !order.productInterest) data.productInterest = ex.productInterest;
  if (ex.market && !order.market) data.market = ex.market;

  const inMoneyState = MONEY_STATES.includes(order.status as OrderStatus);

  // Cart proposal: the model names product ids + quantities; code resolves
  // them against the tenant's real active catalog and recomputes every price.
  // The model's own arithmetic is never trusted, and a paid order's cart is
  // never rewritten by the AI.
  if (
    output.proposedOrder &&
    output.proposedOrder.items.length > 0 &&
    !inMoneyState &&
    order.paymentStatus !== "CONFIRMED" &&
    order.paymentStatus !== "PENDING_CONFIRMATION"
  ) {
    const ids = [...new Set(output.proposedOrder.items.map((i) => i.productId))];
    const catalog = await prisma.product.findMany({
      where: { id: { in: ids }, profileId: profile.id, isActive: true },
    });
    const byId = new Map(catalog.map((p) => [p.id, p]));
    // Market-aware pricing: an SG customer with configured SGD overrides is
    // billed in SGD; everyone else (MY/BN) in MYR. The currency is recorded on
    // each line so the vision amount-match compares like-for-like.
    const market = (ex.market as string | undefined) ?? order.market ?? "MY";
    const useSgd = market === "SG";
    const items = output.proposedOrder.items
      .filter((i) => byId.has(i.productId))
      .map((i) => {
        const p = byId.get(i.productId)!;
        const sgdOk = useSgd && p.priceMemberSgd != null;
        const unitPrice = sgdOk ? p.priceMemberSgd! : p.priceMemberMyr;
        const currency = sgdOk ? "SGD" : "MYR";
        return { productId: p.id, name: p.name, qty: i.qty, unitPriceMyr: unitPrice, currency };
      });
    if (items.length > 0) {
      data.items = toJson(items);
      data.totalMyr = Math.round(items.reduce((sum, i) => sum + i.qty * i.unitPriceMyr, 0) * 100) / 100;
      // Cart agreed → payment instructions are going out in this reply.
      if (order.paymentStatus === "NONE") data.paymentStatus = "INSTRUCTIONS_SENT";
    }
  }

  // Status: whitelist only. Money states are code/agent-only, and BOTH
  // branches below must respect that (the takeover branch silently demoting a
  // paid order out of its money state was a real production bug in Mandy).
  const suggested = output.suggestedStatus as OrderStatus | null | undefined;
  const lowConfidence = output.confidence < 0.4;
  const takeover = output.takeover?.needed || lowConfidence;

  if (takeover) {
    data.needsHuman = true;
    data.takeoverReason =
      output.takeover?.reason || (lowConfidence ? "GC was not confident about this reply." : null);
    if (!inMoneyState) data.status = "Human Takeover Needed";
  } else if (
    suggested &&
    suggested !== order.status &&
    AI_ALLOWED_STATUSES.includes(suggested) &&
    // Never let the AI move an order backwards out of a money state.
    !inMoneyState
  ) {
    data.status = suggested;
  }

  if (Object.keys(data).length === 0) return order;

  return prisma.order.update({ where: { id: order.id }, data });
}

// Persist one customer→GC exchange onto a conversation, and schedule the
// follow-up clock. customerMessage null = the inbound message was already
// stored (e.g. it arrived during a human takeover) — record only GC's reply.
export async function recordExchange(opts: {
  profileId?: string;
  orderId?: string;
  conversationId: string;
  customerMessage: string | null;
  output: EngineOutput;
  attachmentIds?: string[];
  externalMessageId?: string; // e.g. WhatsApp wamid, for redelivery dedupe
}) {
  await prisma.$transaction([
    ...(opts.customerMessage !== null
      ? [
          prisma.message.create({
            data: {
              conversationId: opts.conversationId,
              role: "CUSTOMER",
              content: opts.customerMessage,
              externalId: opts.externalMessageId,
            },
          }),
        ]
      : []),
    prisma.message.create({
      data: {
        conversationId: opts.conversationId,
        role: "GC",
        content: opts.output.reply,
        meta: toJson({
          detectedLanguage: opts.output.detectedLanguage,
          extracted: opts.output.extracted,
          proposedOrder: opts.output.proposedOrder,
          suggestedStatus: opts.output.suggestedStatus,
          takeover: opts.output.takeover,
          confidence: opts.output.confidence,
        }),
        attachmentIds:
          opts.attachmentIds && opts.attachmentIds.length ? toJson(opts.attachmentIds) : null,
      },
    }),
    prisma.conversation.update({
      where: { id: opts.conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);
}

// Arm (or clear) the proactive follow-up timer after an exchange. Called with
// the fresh order row post-applyEngineEffects. A customer message resets the
// count; GC replying just re-arms the clock.
export async function scheduleFollowUp(profile: StoreProfile, order: Order, opts: { customerSpoke: boolean }) {
  const terminal =
    MONEY_STATES.includes(order.status as OrderStatus) ||
    order.status === "Lost" ||
    order.needsHuman;
  const data: Record<string, unknown> = {};

  if (opts.customerSpoke) {
    data.lastCustomerMessageAt = new Date();
    data.followUpCount = 0;
  }

  if (!profile.followUpAfterHours || terminal) {
    data.nextFollowUpAt = null;
  } else {
    data.nextFollowUpAt = new Date(Date.now() + profile.followUpAfterHours * 3600_000);
  }

  await prisma.order.update({ where: { id: order.id }, data });
}

// Optional: refresh order.summary/nextAction after a few exchanges.
export async function refreshOrderSummary(profile: StoreProfile, order: Order, conversationId: string) {
  if (!llmConfigured()) return;
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: HISTORY_LIMIT,
  });
  if (history.length < 4) return;

  const transcript = history
    .map((m) => `${m.role === "CUSTOMER" ? "Customer" : "GC"}: ${m.content}`)
    .join("\n");

  try {
    const raw = await chatComplete({
      system:
        'You summarize sales conversations for an ecommerce CRM. Respond ONLY with JSON: {"summary": "2-3 sentence factual summary", "nextAction": "one concrete recommended next step for the agent"}',
      messages: [{ role: "user", content: transcript.slice(-6000) }],
      maxTokens: 600,
      temperature: 0.2,
    });
    const json = extractJson(raw) as { summary?: string; nextAction?: string } | null;
    if (json?.summary) {
      await prisma.order.update({
        where: { id: order.id },
        data: { summary: json.summary, nextAction: json.nextAction ?? null },
      });
    }
  } catch {
    // Summary refresh is best-effort; never block the reply on it.
  }
}

// Convenience: current cart items for an order (parsed).
export function orderItems(order: Order): { productId: string; name: string; qty: number; unitPriceMyr: number }[] {
  return parseJson(order.items, []);
}
