import { handle } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getPublicOrigin } from "@/lib/http";

// Feeds the Connect guide: the exact webhook URLs + verify token for THIS
// deployment, plus the tenant's current connection status per channel.
export async function GET(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const origin = getPublicOrigin(req);
    const channels = await prisma.channelConnection.findMany({
      where: { profileId: profile.id },
      select: { channel: true, externalId: true, displayName: true, isActive: true },
    });
    return {
      whatsappWebhookUrl: `${origin}/api/webhooks/whatsapp`,
      metaWebhookUrl: `${origin}/api/webhooks/meta`,
      verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || "(set META_WEBHOOK_VERIFY_TOKEN in the server env)",
      connected: {
        WHATSAPP: channels.find((c) => c.channel === "WHATSAPP") ?? null,
        MESSENGER: channels.find((c) => c.channel === "MESSENGER") ?? null,
        INSTAGRAM: channels.find((c) => c.channel === "INSTAGRAM") ?? null,
      },
    };
  });
}
