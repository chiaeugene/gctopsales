import type { PrismaClient } from "@prisma/client";
import { chatComplete, extractJson, llmConfigured } from "@/lib/ai/llm";
import { parseJson } from "@/lib/json";

// Turns real closed conversations into teaching examples.
//
// Deliberately covers BOTH wins and losses. A hub of only wins teaches
// survivorship bias — the lost ones are where the transferable lesson usually
// is, because a loss has a single identifiable moment where it went wrong.

const WON_STATUSES = ["Payment Confirmed", "Processing", "Shipped", "Delivered"];

export type BuildReport = { scanned: number; created: number; updated: number; skipped: number };

// Customer identity never travels into a shared teaching case. The lesson is in
// the moves, not in who the person was.
export function anonymise(text: string, name?: string | null, phone?: string | null): string {
  let out = text;
  if (name && name.trim().length > 1) {
    out = out.replace(new RegExp(escapeRe(name.trim()), "gi"), "[customer]");
    // Also catch a first name used on its own.
    const first = name.trim().split(/\s+/)[0];
    if (first.length > 2) out = out.replace(new RegExp(`\\b${escapeRe(first)}\\b`, "gi"), "[customer]");
  }
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 7) {
      // Match the surrounding digits too. Replacing only the last 8 of
      // "60129455223" would leave "601[number]", which still leaks the country
      // and operator prefix.
      out = out.replace(new RegExp(`\\d*${digits.slice(-8)}\\d*`, "g"), "[number]");
    }
  }
  return (
    out
      // Any remaining long digit run that looks like a phone or account number.
      .replace(/\b\d{9,}\b/g, "[number]")
      .replace(/\b\d{3}[- ]\d{3,4}[- ]?\d{3,4}\b/g, "[number]")
  );
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CASE_SCHEMA = `{
  "headline": "one sentence a seller can act on, max 90 chars, no fluff",
  "whatWorked": "2-4 short bullet-style sentences, the moves that actually moved this sale",
  "whatToAvoid": "2-4 short sentences, what cost momentum or lost it. For a WON case this is still required: what almost went wrong.",
  "keyQuote": "the single most instructive line from the seller, quoted verbatim, or null",
  "turningPoint": "one sentence on what was happening when it turned, or null"
}`;

export async function buildLearningCases(prisma: PrismaClient, opts?: { limit?: number }): Promise<BuildReport> {
  const report: BuildReport = { scanned: 0, created: 0, updated: 0, skipped: 0 };
  if (!llmConfigured()) return report;

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ status: { in: WON_STATUSES } }, { paymentStatus: "CONFIRMED" }, { status: "Lost" }],
    },
    orderBy: { updatedAt: "desc" },
    take: opts?.limit ?? 25,
    include: { conversation: { select: { id: true } } },
  });

  for (const order of orders) {
    report.scanned++;
    if (!order.conversation) {
      report.skipped++;
      continue;
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: order.conversation.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 80,
    });
    // Two messages is not a conversation anyone can learn from.
    if (messages.filter((m) => m.role === "CUSTOMER").length < 2) {
      report.skipped++;
      continue;
    }

    const won = order.paymentStatus === "CONFIRMED" || WON_STATUSES.includes(order.status);
    const transcript = anonymise(
      messages
        .filter((m) => m.role === "CUSTOMER" || m.role === "GC" || m.role === "AGENT")
        .map((m) => `${m.role === "CUSTOMER" ? "Customer" : m.role === "AGENT" ? "Seller" : "GC"}: ${m.content}`)
        .join("\n"),
      order.customerName,
      order.phone
    ).slice(-9000);

    const existing = await prisma.learningCase.findUnique({ where: { orderId: order.id } });
    // Only regenerate if the conversation has grown since the case was written.
    if (existing && existing.transcript.length >= transcript.length) {
      report.skipped++;
      continue;
    }

    const raw = await chatComplete({
      system: `You turn real sales conversations into short teaching cases for a team of wellness sellers in Malaysia and Singapore.

Be concrete and specific to THIS conversation. Quote what was actually said. Never give generic advice like "build rapport" or "understand the customer" — if a lesson would apply to any conversation, it is not worth writing down.

For a LOST case, find the single moment it turned and say plainly what should have happened instead.
For a WON case, name the move that actually earned the sale, and be honest about what nearly cost it.

Output ONE JSON object, no other text:
${CASE_SCHEMA}`,
      messages: [
        {
          role: "user",
          content: `OUTCOME: ${won ? "WON (customer paid)" : "LOST"}\nProduct interest: ${order.productInterest ?? "unknown"}\nMarket: ${order.market ?? "unknown"}\n\nTRANSCRIPT:\n${transcript}`,
        },
      ],
      maxTokens: 1200,
      temperature: 0.3,
    });

    const parsed = extractJson(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed.headline !== "string") {
      report.skipped++;
      continue;
    }

    const report_ = parseJson<{ overall?: number }>(order.salesReport ?? "{}", {});
    const data = {
      profileId: order.profileId,
      outcome: won ? "WON" : "LOST",
      productLine: order.productInterest,
      market: order.market,
      valueMyr: order.totalMyr,
      headline: String(parsed.headline).slice(0, 200),
      whatWorked: String(parsed.whatWorked ?? "").slice(0, 2000),
      whatToAvoid: String(parsed.whatToAvoid ?? "").slice(0, 2000),
      keyQuote: parsed.keyQuote ? String(parsed.keyQuote).slice(0, 600) : null,
      turningPoint: parsed.turningPoint ? String(parsed.turningPoint).slice(0, 600) : null,
      transcript,
      score: typeof report_.overall === "number" ? Math.round(report_.overall) : null,
    };

    if (existing) {
      await prisma.learningCase.update({ where: { orderId: order.id }, data });
      report.updated++;
    } else {
      await prisma.learningCase.create({ data: { ...data, orderId: order.id } });
      report.created++;
    }
  }

  return report;
}

// The part a per-conversation grade cannot give you: what keeps happening across
// many conversations. Computed on demand from existing cases, no extra storage.
export async function summarisePatterns(
  prisma: PrismaClient,
  profileIds: string[]
): Promise<{ wins: string[]; losses: string[]; basedOn: number } | null> {
  const cases = await prisma.learningCase.findMany({
    where: { profileId: { in: profileIds } },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { outcome: true, headline: true, whatWorked: true, whatToAvoid: true },
  });
  if (cases.length < 3 || !llmConfigured()) return null;

  const raw = await chatComplete({
    system: `You find REPEATING patterns across sales cases. Only report something that shows up in at least two different cases — a one-off belongs in its own case, not in a pattern summary.

Output ONE JSON object, no other text:
{"wins": ["3-5 short specific patterns that keep earning sales"], "losses": ["3-5 short specific patterns that keep costing sales"]}`,
    messages: [
      {
        role: "user",
        content: cases
          .map((c, i) => `CASE ${i + 1} [${c.outcome}] ${c.headline}\n worked: ${c.whatWorked}\n avoid: ${c.whatToAvoid}`)
          .join("\n\n")
          .slice(0, 12000),
      },
    ],
    maxTokens: 900,
    temperature: 0.2,
  });

  const parsed = extractJson(raw) as { wins?: string[]; losses?: string[] } | null;
  if (!parsed) return null;
  return {
    wins: (parsed.wins ?? []).slice(0, 6).map(String),
    losses: (parsed.losses ?? []).slice(0, 6).map(String),
    basedOn: cases.length,
  };
}
