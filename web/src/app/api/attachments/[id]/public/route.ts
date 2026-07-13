import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TESTIMONIAL_PHOTO_PREFIX } from "@/lib/attachments";

// Unauthenticated byte-serving route: Messenger/Instagram send attachments
// by URL (not upload-then-reference like WhatsApp), so Meta's servers must
// be able to fetch this without a session. Security is by unguessable cuid
// only — deliberately the same tradeoff already accepted for WhatsApp's
// media upload path. `id` is either a raw ProductImage cuid or a
// testimonial photo id prefixed with "test_".
//
// Deliberately does not use the shared `handle()` wrapper: it always calls
// NextResponse.json(data), which would JSON-serialize this raw byte
// response instead of streaming it.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    if (id.startsWith(TESTIMONIAL_PHOTO_PREFIX)) {
      const testimonialId = id.slice(TESTIMONIAL_PHOTO_PREFIX.length);
      const t = await prisma.testimonial.findUnique({ where: { id: testimonialId } });
      if (!t || !t.photoData || !t.photoMimeType) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
      return new NextResponse(new Uint8Array(t.photoData), {
        headers: {
          "Content-Type": t.photoMimeType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(t.photoFileName || "testimonial")}"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const attachment = await prisma.productImage.findUnique({ where: { id } });
    if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

    return new NextResponse(new Uint8Array(attachment.data), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
