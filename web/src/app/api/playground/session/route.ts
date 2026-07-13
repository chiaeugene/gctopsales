import { handle } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

// Creates a fresh playground order+conversation — a sandboxed customer.
export async function POST() {
  return handle(async () => {
    const profile = await requireProfile();
    const order = await prisma.order.create({
      data: {
        profileId: profile.id,
        source: "PLAYGROUND",
        conversation: { create: { profileId: profile.id, kind: "PLAYGROUND" } },
      },
      include: { conversation: true },
    });
    return { orderId: order.id, conversationId: order.conversation!.id };
  });
}
