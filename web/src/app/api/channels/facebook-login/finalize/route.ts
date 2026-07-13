import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { listManagedPages, subscribePageWebhook, MetaOAuthError } from "@/lib/meta-oauth";
import { takeUserToken } from "@/lib/meta-oauth-selection";
import type { Channel } from "@/lib/constants";

// Step 2: finalize with the Page the agent picked (or the only one they
// have). Connects Messenger always; also connects Instagram in the same
// call when that Page has a linked Instagram professional account and the
// agent asked for it.
const BodySchema = z.object({
  selectionToken: z.string().min(10),
  pageId: z.string().min(1),
  connectInstagram: z.boolean().default(true),
});

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = BodySchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid finalize payload");

    const userAccessToken = takeUserToken(body.data.selectionToken, profile.id);
    if (!userAccessToken) throw new ApiError(400, "This connection attempt expired — please reconnect.");

    let pages;
    try {
      pages = await listManagedPages(userAccessToken);
    } catch (err) {
      if (err instanceof MetaOAuthError) throw new ApiError(502, err.message);
      throw err;
    }
    const page = pages.find((p) => p.id === body.data.pageId);
    if (!page) throw new ApiError(404, "Page not found for this account");

    const connected: { channel: Channel; externalId: string; displayName: string | null }[] = [];

    async function upsert(channel: "MESSENGER" | "INSTAGRAM", externalId: string, accessToken: string, displayName: string | null) {
      const existing = await prisma.channelConnection.findUnique({
        where: { channel_externalId: { channel, externalId } },
      });
      if (existing && existing.profileId !== profile.id) {
        throw new ApiError(409, `This ${channel === "MESSENGER" ? "Page" : "Instagram account"} is already connected to another account.`);
      }
      const conn = existing
        ? await prisma.channelConnection.update({ where: { id: existing.id }, data: { accessToken, displayName: displayName ?? existing.displayName, isActive: true } })
        : await prisma.channelConnection.create({ data: { profileId: profile.id, channel, externalId, accessToken, displayName: displayName ?? undefined } });
      connected.push({ channel, externalId: conn.externalId, displayName: conn.displayName });
    }

    await subscribePageWebhook(page.id, page.access_token).catch((err) => {
      if (err instanceof MetaOAuthError) throw new ApiError(502, err.message);
      throw err;
    });
    await upsert("MESSENGER", page.id, page.access_token, page.name);

    if (body.data.connectInstagram && page.instagram_business_account?.id) {
      // Instagram DM rides on the same Page token/subscription — no separate subscribe call needed.
      await upsert("INSTAGRAM", page.instagram_business_account.id, page.access_token, `${page.name} (Instagram)`);
    }

    return { connected };
  });
}
