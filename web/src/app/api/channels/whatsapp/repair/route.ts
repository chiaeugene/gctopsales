import { handle } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import {
  registerPhoneNumber,
  discoverWabaIds,
  subscribeWabaWebhook,
  fetchPhoneNumberStatus,
} from "@/lib/meta-oauth";

// "Activate number": the one button that makes a connected WhatsApp number
// actually work. Three things must all be true and any of them can silently
// be false after onboarding:
//   1. the token can see the number            (credentials valid)
//   2. THIS app is subscribed to the number's WABA  (inbound messages)
//   3. the number is registered with the Cloud API  (outbound sends)
// We discover the WABA ids from the token itself, so the agent never has to
// find them. Everything is idempotent and safe to re-run.
export async function POST() {
  return handle(async () => {
    const profile = await requireProfile();
    const connections = await prisma.channelConnection.findMany({
      where: { profileId: profile.id, channel: "WHATSAPP", isActive: true },
    });

    const results = [];
    for (const c of connections) {
      const status = await fetchPhoneNumberStatus(c.externalId, c.accessToken);

      const wabaIds = await discoverWabaIds(c.accessToken);
      const subscriptions: { wabaId: string; ok: boolean; detail?: string }[] = [];
      for (const wabaId of wabaIds) {
        try {
          await subscribeWabaWebhook(wabaId, c.accessToken);
          subscriptions.push({ wabaId, ok: true });
        } catch (err) {
          subscriptions.push({ wabaId, ok: false, detail: err instanceof Error ? err.message : "failed" });
        }
      }

      const reg = await registerPhoneNumber(c.externalId, c.accessToken);

      const report = {
        phoneNumberId: c.externalId,
        displayName: c.displayName,
        tokenValid: status.ok,
        number: status.displayPhoneNumber ?? null,
        verifiedName: status.verifiedName ?? null,
        platform: status.platform ?? null,
        tokenDetail: status.detail ?? null,
        wabaIds,
        subscriptions,
        registered: reg.ok,
        registerDetail: reg.detail ?? null,
      };
      console.log("[whatsapp repair]", JSON.stringify(report));
      results.push(report);
    }

    return { connections: results.length, results };
  }, "channels/whatsapp/repair");
}
