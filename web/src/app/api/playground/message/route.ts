import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { generateGcReply, recordExchange, refreshOrderSummary, scheduleFollowUp } from "@/lib/ai/engine";
import { parseJson } from "@/lib/json";

const PostSchema = z.object({
  orderId: z.string(),
  message: z.string().min(1).max(4000),
});

// The playground runs the exact same engine pipeline as the real channels —
// it just skips webhook dedupe/find-or-create since the session's order
// already exists.
export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = PostSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");

    const order = await prisma.order.findFirst({
      where: { id: body.data.orderId, profileId: profile.id },
      include: { conversation: true },
    });
    if (!order || !order.conversation) throw new ApiError(404, "Session not found");

    if (order.needsHuman) {
      // Mirror real-channel behavior: record silently, no AI reply.
      await prisma.message.create({
        data: { conversationId: order.conversation.id, role: "CUSTOMER", content: body.data.message },
      });
      return { reply: null, needsHuman: true, order: publicOrder(order) };
    }

    const { output, order: updated, attachmentIds } = await generateGcReply({
      profile,
      order,
      conversationId: order.conversation.id,
      customerMessage: body.data.message,
    });
    await recordExchange({
      conversationId: order.conversation.id,
      customerMessage: body.data.message,
      output,
      attachmentIds,
    });
    await scheduleFollowUp(profile, updated, { customerSpoke: true });
    refreshOrderSummary(profile, updated, order.conversation.id).catch(() => {});

    const fresh = await prisma.order.findUnique({ where: { id: order.id } });
    return {
      reply: output.reply,
      attachmentIds,
      meta: {
        detectedLanguage: output.detectedLanguage,
        extracted: output.extracted,
        proposedOrder: output.proposedOrder,
        suggestedStatus: output.suggestedStatus,
        takeover: output.takeover,
        confidence: output.confidence,
      },
      order: fresh ? publicOrder(fresh) : null,
    };
  });
}

function publicOrder(o: {
  id: string;
  status: string;
  paymentStatus: string;
  needsHuman: boolean;
  items: string;
  totalMyr: number | null;
  customerName: string | null;
  segment: string | null;
}) {
  return {
    id: o.id,
    status: o.status,
    paymentStatus: o.paymentStatus,
    needsHuman: o.needsHuman,
    items: parseJson(o.items, []),
    totalMyr: o.totalMyr,
    customerName: o.customerName,
    segment: o.segment,
  };
}
