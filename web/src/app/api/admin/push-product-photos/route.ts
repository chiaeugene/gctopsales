import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { pushProductPhotos } from "@/lib/data/push-product-photos";

// Admin-only. Logic lives in lib so a maintenance run and this button cannot drift.
export async function POST() {
  return handle(async () => {
    await requireAdmin();
    return pushProductPhotos(prisma);
  });
}
