import { handle } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { registerPhoneNumber } from "@/lib/meta-oauth";

// Re-runs Cloud API registration for this profile's connected WhatsApp
// numbers. Numbers onboarded via Embedded Signup before the register call was
// added (or whose registration failed) are dead to the API until this
// succeeds — one click from the Connect page fixes them. Idempotent.
export async function POST() {
  return handle(async () => {
    const profile = await requireProfile();
    const connections = await prisma.channelConnection.findMany({
      where: { profileId: profile.id, channel: "WHATSAPP", isActive: true },
    });

    const results = [];
    for (const c of connections) {
      const reg = await registerPhoneNumber(c.externalId, c.accessToken);
      console.log("[whatsapp repair]", c.externalId, reg.ok ? "registered" : `FAILED: ${reg.detail}`);
      results.push({
        externalId: c.externalId,
        displayName: c.displayName,
        registered: reg.ok,
        detail: reg.detail ?? null,
      });
    }
    return { connections: results.length, results };
  }, "channels/whatsapp/repair");
}
