import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import {
  exchangeCodeForToken,
  subscribeWabaWebhook,
  fetchPhoneNumberDisplayName,
  MetaOAuthError,
} from "@/lib/meta-oauth";

// Completes WhatsApp Embedded Signup: the frontend's FB.login popup hands us
// an OAuth code plus the phone_number_id/waba_id the agent picked inside
// Meta's own signup UI (via the WA_EMBEDDED_SIGNUP postMessage event) — no
// token copying, no hunting for a phone number ID.
const BodySchema = z.object({
  code: z.string().min(10),
  wabaId: z.string().min(3),
  phoneNumberId: z.string().min(3),
});

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = BodySchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid embedded signup payload");
    const { code, wabaId, phoneNumberId } = body.data;

    let accessToken: string;
    try {
      accessToken = await exchangeCodeForToken(code);
      await subscribeWabaWebhook(wabaId, accessToken);
    } catch (err) {
      if (err instanceof MetaOAuthError) throw new ApiError(502, err.message);
      throw err;
    }
    const displayName = await fetchPhoneNumberDisplayName(phoneNumberId, accessToken);

    const existing = await prisma.channelConnection.findUnique({
      where: { channel_externalId: { channel: "WHATSAPP", externalId: phoneNumberId } },
    });
    if (existing && existing.profileId !== profile.id) {
      throw new ApiError(409, "This WhatsApp number is already connected to another account.");
    }

    const connection = existing
      ? await prisma.channelConnection.update({
          where: { id: existing.id },
          data: { accessToken, displayName: displayName ?? existing.displayName, isActive: true },
        })
      : await prisma.channelConnection.create({
          data: {
            profileId: profile.id,
            channel: "WHATSAPP",
            externalId: phoneNumberId,
            accessToken,
            displayName: displayName ?? undefined,
          },
        });

    return { id: connection.id, channel: connection.channel, externalId: connection.externalId, displayName: connection.displayName };
  });
}
