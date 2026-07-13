import { handle } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";

export async function GET(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");

    const orders = await prisma.order.findMany({
      where: { profileId: profile.id, ...(status ? { status } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return {
      orders: orders.map((o) => ({
        id: o.id,
        source: o.source,
        customerName: o.customerName,
        phone: o.phone,
        segment: o.segment,
        productInterest: o.productInterest,
        items: parseJson(o.items, []),
        totalMyr: o.totalMyr,
        status: o.status,
        paymentStatus: o.paymentStatus,
        needsHuman: o.needsHuman,
        takeoverReason: o.takeoverReason,
        summary: o.summary,
        nextAction: o.nextAction,
        updatedAt: o.updatedAt,
        createdAt: o.createdAt,
      })),
    };
  });
}
