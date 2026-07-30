import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { pushLibraryAssets } from "@/lib/data/push-library-assets";

// Admin-only. Logic lives in lib so a maintenance run and this button share one
// code path.
export async function POST() {
  return handle(async () => {
    await requireAdmin();
    return pushLibraryAssets(prisma);
  });
}
