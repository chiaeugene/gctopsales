import sharp from "sharp";

// WhatsApp's Cloud API accepts image/jpeg and image/png for image messages and
// nothing else — WEBP is sticker-only and the media upload is rejected outright.
// Every product photo in this system was WEBP, so no image GC chose ever actually
// reached a customer, and the failure was invisible because the sender logs and
// swallows upload errors.
//
// So WEBP is normalised to JPEG at the point of storage rather than at send time:
// converting once on upload is cheaper than converting on every send, and it means
// what the agent sees in the library is exactly what goes out.
export const WHATSAPP_SAFE_IMAGE_MIMES = new Set(["image/jpeg", "image/png"]);

export type NormalisedImage = { data: Uint8Array<ArrayBuffer>; mimeType: string; fileName: string };

export async function normaliseForWhatsApp(
  data: Uint8Array,
  mimeType: string,
  fileName: string
): Promise<NormalisedImage> {
  const passthrough = (): NormalisedImage => ({
    data: toArrayBufferView(data),
    mimeType,
    fileName,
  });

  // PDFs and already-safe images go through untouched.
  if (mimeType === "application/pdf" || WHATSAPP_SAFE_IMAGE_MIMES.has(mimeType)) return passthrough();

  try {
    const jpeg = await sharp(Buffer.from(data))
      // Flatten onto white: WhatsApp composites alpha to black, so a transparent
      // source would arrive as an unreadable dark block.
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
    return {
      data: toArrayBufferView(new Uint8Array(jpeg)),
      mimeType: "image/jpeg",
      fileName: fileName.replace(/\.[^.]+$/, "") + ".jpg",
    };
  } catch (err) {
    // Never lose the upload over a conversion failure — store the original and
    // let the send path complain instead.
    console.error("[images] webp->jpeg conversion failed, storing original", err);
    return passthrough();
  }
}

function toArrayBufferView(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength)) as Uint8Array<ArrayBuffer>;
}
