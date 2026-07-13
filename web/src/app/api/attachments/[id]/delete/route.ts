import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

// Delete a product attachment (tenant-scoped).
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await ctx.params;
    const att = await prisma.productImage.findFirst({ where: { id, profileId: profile.id } });
    if (!att) throw new ApiError(404, "Attachment not found");
    await prisma.productImage.delete({ where: { id } });
    return { ok: true };
  });
}
