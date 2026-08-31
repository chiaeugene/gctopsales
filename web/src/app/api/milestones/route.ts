import { handle } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";
import { milestonesFor } from "@/lib/milestones";

// An agent's own milestones, from the same live counts the admin view uses, so
// the two can never disagree about what somebody has achieved.
export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();

    const [training, channels, paid, conversations] = await Promise.all([
      prisma.trainingExample.count({ where: { profileId: profile.id } }),
      prisma.channelConnection.count({ where: { profileId: profile.id, isActive: true } }),
      prisma.order.count({ where: { profileId: profile.id, paymentStatus: "CONFIRMED" } }),
      prisma.conversation.findMany({
        where: { profileId: profile.id },
        select: { kind: true, _count: { select: { messages: { where: { role: "GC" } } } } },
      }),
    ]);

    let live = 0;
    let practice = 0;
    for (const c of conversations) {
      if (c.kind === "PLAYGROUND") practice += c._count.messages;
      else live += c._count.messages;
    }

    const f = parseJson<Record<string, string>>(profile.fulfillmentBrain, {});
    const paymentReady = Boolean(
      f.paymentBank?.trim() && f.paymentAccountName?.trim() && f.paymentAccountNumber?.trim()
    );

    return {
      milestones: milestonesFor({
        name: profile.agentName ?? "You",
        trainingCount: training,
        practiceReplies: practice,
        paymentReady,
        whatsappConnected: channels > 0,
        liveReplies: live,
        paidOrders: paid,
      }),
      liveReplies: live,
    };
  });
}
