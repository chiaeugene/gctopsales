import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { seedResultsBank } from "@/lib/data/seed-results";

// Admin-only. All the logic lives in lib/data/seed-results so a maintenance
// run and this button can never diverge.
export async function POST() {
  return handle(async () => {
    await requireAdmin();
    return seedResultsBank(prisma);
  });
}
