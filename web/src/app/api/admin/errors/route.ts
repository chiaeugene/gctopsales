import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

// Admin-only view of recent production errors (written by lib/api.ts handle()).
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const errors = await prisma.errorLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    // Housekeeping: prune anything older than 30 days so the table stays tiny.
    prisma.errorLog
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } })
      .catch(() => {});
    return { errors };
  });
}
