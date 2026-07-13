import { NextResponse } from "next/server";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

// The ONE place inbound (customer-uploaded) attachment bytes are ever loaded.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await ctx.params;

    const attachment = await prisma.inboundAttachment.findFirst({
      where: { id, profileId: profile.id },
    });
    if (!attachment) throw new ApiError(404, "Attachment not found");

    return new NextResponse(new Uint8Array(attachment.data), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    }) as unknown as Record<string, never>;
  });
}
