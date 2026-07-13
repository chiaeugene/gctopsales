import type { ProductImage } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024; // 8MB

// Testimonial photos share the same "attachment id" namespace GC's
// sendAttachmentIds output uses for ProductImage ids, disambiguated by this
// prefix so every resolver (serve routes, WhatsApp/Messenger senders) can
// route to the right table without guessing.
export const TESTIMONIAL_PHOTO_PREFIX = "test_";

export type SendableFile = { fileName: string; mimeType: string; fileType: "PHOTO" | "PDF"; data: Uint8Array };
export type SendableFileMeta = { fileName: string; fileType: "PHOTO" | "PDF" };

// Full bytes — used by WhatsApp's upload-then-reference send path. Loads
// exactly one file, never a batch.
export async function resolveSendableAttachment(id: string): Promise<SendableFile | null> {
  if (id.startsWith(TESTIMONIAL_PHOTO_PREFIX)) {
    const t = await prisma.testimonial.findUnique({ where: { id: id.slice(TESTIMONIAL_PHOTO_PREFIX.length) } });
    if (!t || !t.photoData || !t.photoMimeType) return null;
    return { fileName: t.photoFileName || "testimonial.jpg", mimeType: t.photoMimeType, fileType: "PHOTO", data: new Uint8Array(t.photoData) };
  }
  const a = await prisma.productImage.findUnique({ where: { id } });
  if (!a) return null;
  return { fileName: a.fileName, mimeType: a.mimeType, fileType: a.fileType as "PHOTO" | "PDF", data: new Uint8Array(a.data) };
}

// Metadata only — used by Messenger/Instagram's send-by-URL path, which
// never needs the raw bytes on our side.
export async function resolveSendableAttachmentMeta(id: string): Promise<SendableFileMeta | null> {
  if (id.startsWith(TESTIMONIAL_PHOTO_PREFIX)) {
    const t = await prisma.testimonial.findUnique({
      where: { id: id.slice(TESTIMONIAL_PHOTO_PREFIX.length) },
      select: { photoFileName: true, photoMimeType: true },
    });
    if (!t || !t.photoMimeType) return null;
    return { fileName: t.photoFileName || "testimonial.jpg", fileType: "PHOTO" };
  }
  const a = await prisma.productImage.findUnique({ where: { id }, select: { fileName: true, fileType: true } });
  if (!a) return null;
  return { fileName: a.fileName, fileType: a.fileType as "PHOTO" | "PDF" };
}

export const ATTACHMENT_MIME_TO_TYPE: Record<string, "PHOTO" | "PDF"> = {
  "image/jpeg": "PHOTO",
  "image/png": "PHOTO",
  "image/webp": "PHOTO",
  "application/pdf": "PDF",
};

// Attachment metadata without the heavy `data` bytes column. Loading the raw
// bytes for every attachment (e.g. listing products, or on every chat message)
// pulls the whole file payload into memory and OOM-crashes the server — so
// list/chat queries deliberately omit `data`, and only the serve/send paths
// ever load the actual bytes, one file at a time.
export type AttachmentMetadata = Omit<ProductImage, "data">;

// Metadata only — never includes the raw file bytes.
export function serializeAttachment(a: AttachmentMetadata) {
  return {
    id: a.id,
    productId: a.productId,
    fileName: a.fileName,
    label: a.label,
    fileType: a.fileType,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    sortOrder: a.sortOrder,
    url: `/api/attachments/${a.id}`,
  };
}
export type SerializedAttachment = ReturnType<typeof serializeAttachment>;
