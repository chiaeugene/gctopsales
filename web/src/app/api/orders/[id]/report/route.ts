import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { gradeConversation } from "@/lib/ai/report-card";

// On-demand sales report card: grades this conversation and returns the
// scores + coaching. (Also generated automatically when an order is paid or
// marked lost — see applyOrderEdit hook.)
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await ctx.params;
    const order = await prisma.order.findFirst({
      where: { id, profileId: profile.id },
      include: { conversation: true },
    });
    if (!order || !order.conversation) throw new ApiError(404, "Order not found");

    const report = await gradeConversation(profile, order, order.conversation.id);
    if (!report) throw new ApiError(422, "Not enough conversation to grade yet.");
    return { report };
  });
}
