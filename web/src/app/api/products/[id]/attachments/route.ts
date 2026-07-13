import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TO_TYPE } from "@/lib/attachments";

// Upload a photo or PDF to a product. These are the files GC can choose to
// send during a conversation (a product shot, a price card PDF, a
// testimonial image). The `label` tells GC when it's appropriate to send.
// BLOB discipline: bytes are written here and only ever read back by the one
// byte-serving route (/api/attachments/[id]).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id: productId } = await ctx.params;

    const product = await prisma.product.findFirst({ where: { id: productId, profileId: profile.id } });
    if (!product) throw new ApiError(404, "Product not found");

    const form = await req.formData();
    const file = form.get("file");
    const label = form.get("label");
    if (!(file instanceof File)) throw new ApiError(400, "file is required");

    const fileType = ATTACHMENT_MIME_TO_TYPE[file.type];
    if (!fileType) throw new ApiError(400, "Only JPEG/PNG/WebP images or PDF are supported");
    if (file.size > ATTACHMENT_MAX_BYTES) throw new ApiError(413, "File too large (max 8MB)");

    const data = new Uint8Array(await file.arrayBuffer()) as Uint8Array<ArrayBuffer>;
    const count = await prisma.productImage.count({ where: { productId } });
    const created = await prisma.productImage.create({
      data: {
        profileId: profile.id,
        productId,
        fileName: file.name || "upload",
        label: typeof label === "string" && label.trim() ? label.trim() : null,
        fileType,
        mimeType: file.type,
        data,
        sizeBytes: data.length,
        sortOrder: count,
      },
      omit: { data: true },
    });

    return { id: created.id, fileName: created.fileName, label: created.label, fileType: created.fileType, url: `/api/attachments/${created.id}` };
  });
}
