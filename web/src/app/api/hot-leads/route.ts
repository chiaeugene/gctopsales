import { handle } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { scoreLead } from "@/lib/orders/lead-score";

// The priority queue: open leads ranked by buying temperature, so the agent
// works the closest-to-buy first.
export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    const orders = await prisma.order.findMany({
      where: {
        profileId: profile.id,
        status: { notIn: ["Lost", "Payment Confirmed", "Processing", "Shipped", "Delivered"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    const scored = orders
      .map((o) => ({ order: o, score: scoreLead(o) }))
      .filter((x) => x.score.score > 0 || x.order.needsHuman)
      .sort((a, b) => b.score.score - a.score.score);

    return {
      leads: scored.map(({ order, score }) => ({
        id: order.id,
        customerName: order.customerName || order.externalContactId || "New customer",
        source: order.source,
        status: order.status,
        productInterest: order.productInterest,
        totalMyr: order.totalMyr,
        needsHuman: order.needsHuman,
        score: score.score,
        temp: score.temp,
        reasons: score.reasons,
        summary: order.summary,
      })),
    };
  });
}
