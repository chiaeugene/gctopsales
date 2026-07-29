import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

// Admin-only activity tree: every agent, expandable into their live pipeline
// and most recent conversations. Read-only summaries — no message bodies.
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const profiles = await prisma.storeProfile.findMany({
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: "asc" },
    });

    const agents = await Promise.all(
      profiles.map(async (p) => {
        const [total, paid, needsHuman, recent] = await Promise.all([
          prisma.order.count({ where: { profileId: p.id } }),
          prisma.order.count({ where: { profileId: p.id, paymentStatus: "CONFIRMED" } }),
          prisma.order.count({ where: { profileId: p.id, needsHuman: true } }),
          prisma.order.findMany({
            where: { profileId: p.id },
            orderBy: { updatedAt: "desc" },
            take: 6,
            select: {
              id: true,
              customerName: true,
              status: true,
              paymentStatus: true,
              needsHuman: true,
              totalMyr: true,
              leadSource: true,
              updatedAt: true,
              summary: true,
            },
          }),
        ]);
        return {
          profileId: p.id,
          name: p.agentName || p.user.name,
          email: p.user.email,
          role: p.user.role,
          storeName: p.storeName,
          total,
          paid,
          needsHuman,
          recent: recent.map((o) => ({
            id: o.id,
            customer: o.customerName || "Unnamed",
            status: o.status,
            converted: o.paymentStatus === "CONFIRMED",
            needsHuman: o.needsHuman,
            totalMyr: o.totalMyr,
            leadSource: o.leadSource,
            updatedAt: o.updatedAt,
            summary: o.summary?.slice(0, 120) ?? null,
          })),
        };
      })
    );

    return { agents };
  });
}
