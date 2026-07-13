import type { Order } from "@prisma/client";
import { parseJson } from "@/lib/json";
import { MONEY_STATES, type OrderStatus } from "@/lib/constants";

// Buying temperature: a deterministic 0-100 score + reasons, so agents chase
// the closest-to-buy first and follow-ups prioritize the hottest leads.
// Pure function of the order row — no I/O, easy to test and cheap to call.

export type LeadScore = {
  score: number; // 0-100
  temp: "hot" | "warm" | "cold";
  reasons: string[];
};

const STAGE_POINTS: Record<string, number> = {
  "New Inquiry": 5,
  Qualifying: 20,
  Recommended: 40,
  Closing: 60,
  "Awaiting Payment": 80,
};

export function scoreLead(order: Order): LeadScore {
  const reasons: string[] = [];
  let score = 0;

  // Already paid / fulfilled / lost / frozen → not an active sales lead.
  if (MONEY_STATES.includes(order.status as OrderStatus)) {
    return { score: 0, temp: "cold", reasons: ["Already paid — not an open lead"] };
  }
  if (order.status === "Lost") return { score: 0, temp: "cold", reasons: ["Marked lost"] };
  if (order.needsHuman) {
    // A human handoff is urgent for the agent even if not "hot" in sales terms.
    reasons.push("Needs your attention");
  }

  // 1. Pipeline stage — the strongest signal.
  const stagePts = STAGE_POINTS[order.status] ?? 5;
  score += stagePts;
  if (stagePts >= 40) reasons.push(`Reached "${order.status}"`);

  // 2. A live cart with a total = real intent.
  const items = parseJson<{ qty: number }[]>(order.items, []);
  if (items.length > 0 && order.totalMyr) {
    score += 15;
    reasons.push(`Cart built (RM${order.totalMyr})`);
  }

  // 3. Payment instructions already sent = on the doorstep.
  if (order.paymentStatus === "INSTRUCTIONS_SENT") {
    score += 20;
    reasons.push("Payment instructions sent");
  } else if (order.paymentStatus === "PENDING_CONFIRMATION") {
    score += 25;
    reasons.push("Payment proof pending verification");
  }

  // 4. We know what they want / who they are = qualified.
  if (order.productInterest) {
    score += 5;
    reasons.push("Product interest known");
  }
  if (order.segment) score += 3;

  // 5. Recency / decay — a lead cools as it goes silent.
  const lastAt = order.lastCustomerMessageAt ?? order.updatedAt;
  const hours = (Date.now() - new Date(lastAt).getTime()) / 3600_000;
  if (hours <= 2) {
    score += 12;
    reasons.push("Active right now");
  } else if (hours <= 24) {
    score += 6;
    reasons.push("Active today");
  } else if (hours <= 72) {
    score += 0;
  } else if (hours <= 24 * 7) {
    score -= 10;
    reasons.push("Quiet for days");
  } else {
    score -= 20;
    reasons.push("Cold — quiet over a week");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const temp: LeadScore["temp"] = score >= 65 ? "hot" : score >= 35 ? "warm" : "cold";
  return { score, temp, reasons };
}
