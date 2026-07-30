import { NextResponse } from "next/server";
import { UnauthorizedError, requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { TESTIMONIAL_PHOTO_PREFIX, MEDIA_ASSET_PREFIX } from "@/lib/attachments";

// The ONE place attachment bytes are ever loaded for the authenticated
// CRM/playground preview — fetches exactly one row and streams it.
// Everything else uses metadata-only queries. `id` is either a raw
// ProductImage cuid, or a testimonial photo id prefixed with "test_".
//
// Deliberately bypasses the shared `handle()` wrapper: it always calls
// NextResponse.json(data), which would JSON-serialize this raw byte
// response instead of streaming it.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireProfile();
    const { id } = await ctx.params;

    if (id.startsWith(MEDIA_ASSET_PREFIX)) {
      const m = await prisma.mediaAsset.findFirst({
        where: { id: id.slice(MEDIA_ASSET_PREFIX.length), profileId: profile.id },
      });
      if (!m) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
      return new NextResponse(new Uint8Array(m.data), {
        headers: {
          "Content-Type": m.mimeType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(m.fileName)}"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    if (id.startsWith(TESTIMONIAL_PHOTO_PREFIX)) {
      const testimonialId = id.slice(TESTIMONIAL_PHOTO_PREFIX.length);
      const t = await prisma.testimonial.findFirst({ where: { id: testimonialId, profileId: profile.id } });
      if (!t || !t.photoData || !t.photoMimeType) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
      return new NextResponse(new Uint8Array(t.photoData), {
        headers: {
          "Content-Type": t.photoMimeType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(t.photoFileName || "testimonial")}"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    const attachment = await prisma.productImage.findFirst({
      where: { id, profileId: profile.id },
    });
    if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

    return new NextResponse(new Uint8Array(attachment.data), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error(err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
