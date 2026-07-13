import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TO_TYPE, TESTIMONIAL_PHOTO_PREFIX } from "@/lib/attachments";

// Upload (or replace) a testimonial's before/after photo. One photo per
// testimonial — quote and picture live together, and GC decides on her own
// when it fits to send it (see engine.ts), not via manual dispatch.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await ctx.params;

    const testimonial = await prisma.testimonial.findFirst({ where: { id, profileId: profile.id } });
    if (!testimonial) throw new ApiError(404, "Testimonial not found");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "file is required");

    const fileType = ATTACHMENT_MIME_TO_TYPE[file.type];
    if (fileType !== "PHOTO") throw new ApiError(400, "Only JPEG/PNG/WebP images are supported");
    if (file.size > ATTACHMENT_MAX_BYTES) throw new ApiError(413, "File too large (max 8MB)");

    const data = new Uint8Array(await file.arrayBuffer()) as Uint8Array<ArrayBuffer>;
    await prisma.testimonial.update({
      where: { id },
      data: {
        photoData: data,
        photoMimeType: file.type,
        photoFileName: file.name || "testimonial.jpg",
        photoSizeBytes: data.length,
      },
    });

    return { url: `/api/attachments/${TESTIMONIAL_PHOTO_PREFIX}${id}` };
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await ctx.params;
    const testimonial = await prisma.testimonial.findFirst({ where: { id, profileId: profile.id } });
    if (!testimonial) throw new ApiError(404, "Testimonial not found");
    await prisma.testimonial.update({
      where: { id },
      data: { photoData: null, photoMimeType: null, photoFileName: null, photoSizeBytes: null },
    });
    return { ok: true };
  });
}
