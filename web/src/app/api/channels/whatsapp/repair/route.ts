import { handle } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import {
  registerPhoneNumber,
  discoverWabaIds,
  subscribeWabaWebhook,
  fetchPhoneNumberStatus,
  upgradeToLongLivedToken,
  inspectTokenExpiry,
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
      // Try to salvage a short-lived token first; persist if it improved.
      const upgraded = await upgradeToLongLivedToken(c.accessToken);
      let token = c.accessToken;
      if (upgraded !== c.accessToken) {
        await prisma.channelConnection.update({ where: { id: c.id }, data: { accessToken: upgraded } });
        token = upgraded;
      }

      const expiry = await inspectTokenExpiry(token);
      const status = await fetchPhoneNumberStatus(c.externalId, token);

      const wabaIds = await discoverWabaIds(token);
      const subscriptions: { wabaId: string; ok: boolean; detail?: string }[] = [];
      for (const wabaId of wabaIds) {
        try {
          await subscribeWabaWebhook(wabaId, token);
          subscriptions.push({ wabaId, ok: true });
        } catch (err) {
          subscriptions.push({ wabaId, ok: false, detail: err instanceof Error ? err.message : "failed" });
        }
      }

      // A number already on the Cloud API needs no registration — skip the
      // call entirely rather than provoking a confusing PIN error.
      const alreadyOnCloud = status.platform === "CLOUD_API";
      const reg = alreadyOnCloud
        ? { ok: true, detail: "already on Cloud API" }
        : await registerPhoneNumber(c.externalId, token);

      const report = {
        phoneNumberId: c.externalId,
        displayName: c.displayName,
        tokenValid: status.ok,
        tokenExpiresInDays: expiry.expiresInDays,
        tokenNeverExpires: expiry.valid && expiry.expiresInDays === null,
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
