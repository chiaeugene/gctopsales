import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { buildLearningCases } from "@/lib/learning";

// Admin-only: scan recent won/lost orders and turn them into teaching cases.
// Also wired into the cron so the hub keeps learning without anyone clicking.
export async function POST() {
  return handle(async () => {
    await requireAdmin();
    return buildLearningCases(prisma, { limit: 25 });
  });
}
