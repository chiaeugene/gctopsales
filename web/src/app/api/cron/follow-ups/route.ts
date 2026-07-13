import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateGcReply, recordExchange, scheduleFollowUp } from "@/lib/ai/engine";
import { buildFollowUpInstruction } from "@/lib/ai/prompts";
import { sendWhatsAppText, sendWhatsAppAttachmentsByIds } from "@/lib/channels/whatsapp";
import { sendMetaText, sendMetaAttachmentsByIds } from "@/lib/channels/meta-messaging";

// The proactive half of the sales machine: orders whose follow-up timer has
// expired get one GC-drafted nudge each. Trigger this route on a schedule
// (Vercel cron, external cron, or `curl` in a loop) with the CRON_SECRET.
//
// Channel note: WhatsApp/Messenger/IG all restrict business-initiated
// messages to a ~24h customer-service window. followUpAfterHours should stay
// under 24 so nudges land inside the window; sends outside it fail at Meta's
// side and are logged, never thrown.

const BATCH_LIMIT = 20;

// Vercel cron invokes via GET with an `Authorization: Bearer $CRON_SECRET`
// header (when CRON_SECRET is set); manual/external schedulers can POST the
// same. Both share one handler.
export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}

async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await prisma.order.findMany({
    where: {
      nextFollowUpAt: { lte: new Date() },
      needsHuman: false,
    },
    include: { conversation: true, profile: true },
    orderBy: { nextFollowUpAt: "asc" },
    take: BATCH_LIMIT,
  });

  let sent = 0;
  for (const order of due) {
    const profile = order.profile;
    try {
      // Exhausted the follow-up budget → stop chasing, leave the order as-is.
      if (order.followUpCount >= (profile.maxFollowUps ?? 3)) {
        await prisma.order.update({ where: { id: order.id }, data: { nextFollowUpAt: null } });
        continue;
      }
      if (!order.conversation) {
        await prisma.order.update({ where: { id: order.id }, data: { nextFollowUpAt: null } });
        continue;
      }

      const followUpNumber = order.followUpCount + 1;
      const { output, order: updated, attachmentIds } = await generateGcReply({
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

      // Deliver on the order's real channel (playground follow-ups just sit
      // in the thread for the next time the tester opens it).
      if (order.source !== "PLAYGROUND" && order.externalContactId) {
        const connection = await prisma.channelConnection.findFirst({
          where: { profileId: profile.id, channel: order.source, isActive: true },
        });
        if (connection) {
          if (order.source === "WHATSAPP") {
            const creds = { phoneNumberId: connection.externalId, accessToken: connection.accessToken };
            await sendWhatsAppText(creds, order.externalContactId, output.reply);
            if (attachmentIds.length) await sendWhatsAppAttachmentsByIds(creds, order.externalContactId, attachmentIds);
          } else {
            const creds = { pageId: connection.externalId, accessToken: connection.accessToken };
            await sendMetaText(creds, order.externalContactId, output.reply);
            if (attachmentIds.length) await sendMetaAttachmentsByIds(creds, order.externalContactId, attachmentIds);
          }
        }
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { followUpCount: followUpNumber },
      });
      // Re-arm (or clear) the timer based on the fresh post-effects state.
      await scheduleFollowUp(profile, { ...updated, followUpCount: followUpNumber }, { customerSpoke: false });
      sent++;
    } catch (err) {
      console.error("[follow-ups] failed for order", order.id, err);
      // Don't retry-loop a broken order every minute — push it back an hour.
      await prisma.order
        .update({ where: { id: order.id }, data: { nextFollowUpAt: new Date(Date.now() + 3600_000) } })
        .catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, due: due.length, sent });
}
