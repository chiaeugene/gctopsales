import type { Order, StoreProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { chatComplete, extractJson, llmConfigured } from "@/lib/ai/llm";
import { toJson } from "@/lib/json";

export type SalesReport = {
  scores: { discovery: number; uspMatch: number; objectionHandling: number; closing: number };
  overall: number; // 0-100
  outcome: "won" | "lost" | "in_progress";
  lostReason: string | null;
  whatWentWell: string;
  coachingTip: string;
  gradedAt: string;
};

// Post-conversation analysis: grades how well the sale was worked and coaches
// the agent. Used both to give per-conversation feedback and to aggregate
// lost-sale reasons on the dashboard. Best-effort — returns null on failure.
export async function gradeConversation(profile: StoreProfile, order: Order, conversationId: string): Promise<SalesReport | null> {
  if (!llmConfigured()) return null;

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 60,
  });
  if (messages.length < 2) return null;

  const transcript = messages
    .filter((m) => m.role === "CUSTOMER" || m.role === "GC" || m.role === "AGENT")
    .map((m) => `${m.role === "CUSTOMER" ? "Customer" : m.role === "AGENT" ? "Seller(human)" : "GC"}: ${m.content}`)
    .join("\n")
    .slice(-8000);

  const paid = order.paymentStatus === "CONFIRMED";
  const lost = order.status === "Lost";
  const outcomeHint = paid ? "This order was PAID (won)." : lost ? "This order is marked Lost." : "This order is still in progress.";

  try {
    const raw = await chatComplete({
      system: `You are a sharp sales coach for MAE Global wellness sellers. Analyze the conversation transcript and grade how well the sale was worked, like a top sales manager doing a call review. Be honest and specific. Respond ONLY with one JSON object:
{
  "scores": { "discovery": 0-10, "uspMatch": 0-10, "objectionHandling": 0-10, "closing": 0-10 },
  "overall": 0-100,
  "outcome": "won" | "lost" | "in_progress",
  "lostReason": "if lost or stalled, the single most likely reason (short); else null",
  "whatWentWell": "one concrete thing done well (short)",
  "coachingTip": "the single highest-impact thing to do better next time (short, actionable)"
}
Scoring guide: discovery = did they understand the customer's real problem & motive before pitching; uspMatch = did they recommend the right product and frame its USP to the customer's motive; objectionHandling = did they surface and resolve concerns with empathy + proof; closing = did they build value, create honest urgency, and actually ask for the sale. ${outcomeHint}`,
      messages: [{ role: "user", content: transcript }],
      maxTokens: 1200,
      temperature: 0.2,
    });
    const json = extractJson(raw) as Partial<SalesReport> | null;
    if (!json || !json.scores) {
      console.error("[report-card] unparseable grader output:", raw.slice(0, 400));
      return null;
    }

    const report: SalesReport = {
      scores: {
        discovery: clamp(json.scores.discovery, 0, 10),
        uspMatch: clamp(json.scores.uspMatch, 0, 10),
        objectionHandling: clamp(json.scores.objectionHandling, 0, 10),
        closing: clamp(json.scores.closing, 0, 10),
      },
      overall: clamp(typeof json.overall === "number" ? json.overall : 0, 0, 100),
      outcome: paid ? "won" : lost ? "lost" : json.outcome === "won" || json.outcome === "lost" ? json.outcome : "in_progress",
      lostReason: typeof json.lostReason === "string" ? json.lostReason : null,
      whatWentWell: typeof json.whatWentWell === "string" ? json.whatWentWell : "",
      coachingTip: typeof json.coachingTip === "string" ? json.coachingTip : "",
      gradedAt: new Date().toISOString(),
    };

    await prisma.order.update({ where: { id: order.id }, data: { salesReport: toJson(report) } });
    return report;
  } catch (err) {
    console.error("[report-card] grading failed (non-fatal)", err);
    return null;
  }
}

function clamp(n: number | undefined, lo: number, hi: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
