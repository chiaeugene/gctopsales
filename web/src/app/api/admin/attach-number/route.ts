import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  subscribeWabaWebhook,
  registerPhoneNumber,
  upgradeToLongLivedToken,
  fetchPhoneNumberDisplayName,
  MetaOAuthError,
} from "@/lib/meta-oauth";

/**
 * Attach a WhatsApp number that YOU own to an agent's workspace.
 *
 * Embedded Signup always creates a WABA owned by the person clicking, which is
 * right when each agent brings their own business. It is wrong when the numbers
 * live under one verified business portfolio, because then the admin holds every
 * number and there is no way for an agent to connect one they do not own.
 *
 * Rather than have an admin log in as each agent to paste the same credentials,
 * this writes the connection straight onto the chosen agent's profile. The
 * ChannelConnection row is identical to the one Embedded Signup produces, so
 * everything downstream — the webhook routing, the health check, the activity
 * log — behaves exactly the same.
 */
const Schema = z.object({
  userId: z.string(),
  phoneNumberId: z.string().min(3).max(100),
  wabaId: z.string().min(3).max(100),
  accessToken: z.string().min(10),
});

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = Schema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Need the agent, the phone number ID, the WABA ID and a token");
    const { userId, phoneNumberId, wabaId } = body.data;

    const target = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { select: { id: true, agentName: true } } },
    });
    if (!target?.profile) throw new ApiError(404, "That user has no workspace");

    let accessToken: string;
    let registered = false;
    let displayName: string | null = null;
    try {
      // Console tokens are usually short-lived; a system-user token passes through
      // unchanged. Either way, store the longest-lived form available.
      accessToken = await upgradeToLongLivedToken(body.data.accessToken);
      // Without subscribing THIS app to THAT WABA, Meta never delivers inbound
      // messages, and the connection looks perfect while nothing ever arrives.
      await subscribeWabaWebhook(wabaId, accessToken);
      const reg = await registerPhoneNumber(phoneNumberId, accessToken);
      registered = reg.ok;
      displayName = await fetchPhoneNumberDisplayName(phoneNumberId, accessToken);
    } catch (err) {
      if (err instanceof MetaOAuthError) throw new ApiError(502, err.message);
      throw err;
    }

    const existing = await prisma.channelConnection.findUnique({
      where: { channel_externalId: { channel: "WHATSAPP", externalId: phoneNumberId } },
    });
    if (existing && existing.profileId !== target.profile.id) {
      throw new ApiError(409, "That number is already connected to a different agent.");
    }

    await (existing
      ? prisma.channelConnection.update({
          where: { id: existing.id },
          data: { accessToken, displayName: displayName ?? existing.displayName, isActive: true },
        })
      : prisma.channelConnection.create({
          data: {
            profileId: target.profile.id,
            channel: "WHATSAPP",
            externalId: phoneNumberId,
            accessToken,
            displayName: displayName ?? undefined,
          },
        }));

    logActivity({
      profileId: target.profile.id,
      actor: target.profile.agentName ?? target.email,
      type: "connect_ok",
      summary: `Admin attached WhatsApp ${displayName ?? phoneNumberId}${registered ? "" : " (number not registered yet)"}`,
      ok: registered,
    });

    return { ok: true, email: target.email, displayName, registered };
  });
}
