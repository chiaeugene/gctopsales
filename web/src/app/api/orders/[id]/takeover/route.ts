import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { generateGcReply, recordExchange, scheduleFollowUp } from "@/lib/ai/engine";
import { MONEY_STATES, type OrderStatus } from "@/lib/constants";
import { sendWhatsAppText } from "@/lib/channels/whatsapp";
import { sendMetaText } from "@/lib/channels/meta-messaging";

const PostSchema = z.object({
  action: z.enum(["take", "release"]),
  // Optional manual message the agent sends while holding the conversation.
  message: z.string().max(4000).optional(),
});

// Take over: freeze GC out of the conversation. Release: hand it back — GC
// immediately replies to anything the customer said in the meantime.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await ctx.params;
    const body = PostSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");

    const order = await prisma.order.findFirst({
      where: { id, profileId: profile.id },
      include: { conversation: true },
    });
    if (!order || !order.conversation) throw new ApiError(404, "Order not found");
    const conversationId = order.conversation.id;

    if (body.data.action === "take") {
      const inMoneyState = MONEY_STATES.includes(order.status as OrderStatus);
      await prisma.order.update({
        where: { id: order.id },
        data: {
          needsHuman: true,
          takeoverReason: "Agent manually took over.",
          ...(inMoneyState ? {} : { status: "Human Takeover Needed" }),
          nextFollowUpAt: null,
        },
      });

      if (body.data.message?.trim()) {
        await prisma.message.create({
          data: { conversationId, role: "AGENT", content: body.data.message.trim() },
        });
        await deliverToChannel(profile.id, order.source, order.externalContactId, body.data.message.trim());
      }
      return { ok: true, needsHuman: true };
    }

    // release
    const released = await prisma.order.update({
      where: { id: order.id },
      data: { needsHuman: false, takeoverReason: null },
    });

    // If the last message is an unanswered customer message, GC picks the
    // conversation right back up.
    const last = await prisma.message.findFirst({
      where: { conversationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (last?.role === "CUSTOMER") {
      const { output, order: updated, attachmentIds } = await generateGcReply({
        profile,
        order: released,
        conversationId,
        customerMessage: null,
      });
      await recordExchange({ conversationId, customerMessage: null, output, attachmentIds });
      await scheduleFollowUp(profile, updated, { customerSpoke: false });
      await deliverToChannel(profile.id, order.source, order.externalContactId, output.reply);
      return { ok: true, needsHuman: false, reply: output.reply };
    }

    return { ok: true, needsHuman: false };
  });
}

async function deliverToChannel(
  profileId: string,
  source: string,
  externalContactId: string | null,
  text: string
) {
  if (source === "PLAYGROUND" || !externalContactId) return;
  const connection = await prisma.channelConnection.findFirst({
    where: { profileId, channel: source, isActive: true },
  });
  if (!connection) return;
  if (source === "WHATSAPP") {
    await sendWhatsAppText(
      { phoneNumberId: connection.externalId, accessToken: connection.accessToken },
      externalContactId,
      text
    );
  } else {
    await sendMetaText(
      { pageId: connection.externalId, accessToken: connection.accessToken },
      externalContactId,
      text
    );
  }
}
