import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { generateGcReply, recordExchange } from "@/lib/ai/engine";
import { buildFollowUpInstruction } from "@/lib/ai/prompts";

const PostSchema = z.object({ orderId: z.string() });

// Manual-mode follow-ups: while channels aren't connected, nothing auto-sends.
// The agent presses "Suggest follow-up" on a quiet chat and GC drafts the
// nudge (same prompt the auto scheduler would use) into the thread, where the
// agent copies it to the customer. Counts toward the same max-follow-ups
// budget so GC never over-chases a lead.
export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = PostSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");

    const order = await prisma.order.findFirst({
      where: { id: body.data.orderId, profileId: profile.id },
      include: { conversation: true },
    });
    if (!order || !order.conversation) throw new ApiError(404, "Chat not found");
    if (order.needsHuman) throw new ApiError(409, "You've taken over this chat — GC stays quiet.");

    const maxFollowUps = profile.maxFollowUps ?? 3;
    if (order.followUpCount >= maxFollowUps) {
      throw new ApiError(
        409,
        `GC already suggested ${maxFollowUps} follow-ups for this customer — chasing more usually hurts. Reach out personally if you still want to.`
      );
    }

    const followUpNumber = order.followUpCount + 1;
    const { output, attachmentIds } = await generateGcReply({
      profile,
      order,
      conversationId: order.conversation.id,
      customerMessage: null,
      systemNudge: buildFollowUpInstruction(followUpNumber),
    });

    await recordExchange({
      conversationId: order.conversation.id,
      customerMessage: null,
      output,
      attachmentIds,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { followUpCount: followUpNumber, nextFollowUpAt: null },
    });

    return { reply: output.reply, attachmentIds, followUpNumber, maxFollowUps };
  });
}
