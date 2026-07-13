import type { Order, StoreProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gradeConversation } from "@/lib/ai/report-card";

// The ONE place that ever applies an order update involving money-state
// fields — whether triggered by the agent's own edits (PATCH
// /api/orders/[id], which may include other field changes in the same
// request) or a verified AI payment confirmation (recordInboundImageMessage,
// which only ever passes { paymentStatus: "CONFIRMED" }). Nothing else in
// the codebase may set paymentStatus to CONFIRMED or status to a money
// state. `data` is mutated and used as-is.
export async function applyOrderEdit(
  profile: StoreProfile,
  order: Order,
  data: Record<string, unknown>
): Promise<Order> {
  // Confirming the payment implies the order is secured.
  if (data.paymentStatus === "CONFIRMED" && !data.status) {
    data.status = "Payment Confirmed";
  }
  // A confirmed payment ends the follow-up chase.
  if (data.paymentStatus === "CONFIRMED") {
    data.nextFollowUpAt = null;
  }
  const updated = await prisma.order.update({ where: { id: order.id }, data });

  // Auto-grade the conversation the moment it reaches a terminal outcome
  // (won or lost) — feeds per-order coaching and dashboard analytics. Fire
  // and forget; never block the money write on the grader.
  const becameWon = data.paymentStatus === "CONFIRMED" && order.paymentStatus !== "CONFIRMED";
  const becameLost = data.status === "Lost" && order.status !== "Lost";
  if (becameWon || becameLost) {
    const convo = await prisma.conversation.findFirst({ where: { orderId: order.id } });
    if (convo) gradeConversation(profile, updated, convo.id).catch(() => {});
  }

  return updated;
}

// Convenience wrapper for the AI-verified auto-confirm path, which never has
// other simultaneous field edits to apply.
export async function confirmPayment(profile: StoreProfile, order: Order): Promise<Order> {
  return applyOrderEdit(profile, order, { paymentStatus: "CONFIRMED" });
}
