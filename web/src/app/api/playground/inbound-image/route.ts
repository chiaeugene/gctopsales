import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { recordInboundImageMessage } from "@/lib/webhooks/inbound";
import { inboundMimeToType, INBOUND_ATTACHMENT_MAX_BYTES } from "@/lib/inbound-attachments";

// Playground upload button — simulates a customer sending a payment-proof
// photo, exercising the exact same deterministic image path the real
// channels use (including opt-in vision auto-confirm with amount match).
export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const form = await req.formData();
    const orderId = form.get("orderId");
    const file = form.get("file");
    const caption = form.get("caption");

    if (typeof orderId !== "string" || !(file instanceof File)) {
      throw new ApiError(400, "orderId and file are required");
    }
    const fileType = inboundMimeToType(file.type);
    if (!fileType) throw new ApiError(400, "Only JPEG/PNG/WebP images are supported");
    if (file.size > INBOUND_ATTACHMENT_MAX_BYTES) throw new ApiError(413, "Image too large (max 5MB)");

    const order = await prisma.order.findFirst({
      where: { id: orderId, profileId: profile.id },
      include: { conversation: true },
    });
    if (!order) throw new ApiError(404, "Session not found");

    const data = new Uint8Array(await file.arrayBuffer()) as Uint8Array<ArrayBuffer>;
    const attachment = await prisma.inboundAttachment.create({
      data: {
        profileId: profile.id,
        fileName: file.name || "playground-upload",
        fileType,
        mimeType: file.type,
        data,
        sizeBytes: data.length,
      },
    });

    const result = await recordInboundImageMessage({
      profile,
      order,
      inboundAttachmentId: attachment.id,
      caption: typeof caption === "string" ? caption : undefined,
    });

    const fresh = await prisma.order.findUnique({ where: { id: order.id } });
    return {
      ackReply: result?.ackReply ?? null,
      order: fresh
        ? {
            id: fresh.id,
            status: fresh.status,
            paymentStatus: fresh.paymentStatus,
            needsHuman: fresh.needsHuman,
            totalMyr: fresh.totalMyr,
          }
        : null,
    };
  });
}
