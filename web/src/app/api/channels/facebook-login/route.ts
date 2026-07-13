import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { exchangeCodeForToken, listManagedPages, MetaOAuthError } from "@/lib/meta-oauth";
import { stashUserToken } from "@/lib/meta-oauth-selection";

// Step 1 of Facebook Login for Business: exchange the FB.login code for a
// user token and list the Pages the agent manages. The raw user token never
// reaches the browser — only an opaque, single-use selectionToken does,
// which the frontend passes to /api/channels/facebook-login/finalize along
// with the chosen Page (auto-picked if there's only one).
const StartSchema = z.object({ code: z.string().min(10) });

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = StartSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid login payload");

    let userAccessToken: string;
    let pages;
    try {
      userAccessToken = await exchangeCodeForToken(body.data.code);
      pages = await listManagedPages(userAccessToken);
    } catch (err) {
      if (err instanceof MetaOAuthError) throw new ApiError(502, err.message);
      throw err;
    }

    if (pages.length === 0) {
      throw new ApiError(400, "No Facebook Page found for this account. Create or get admin access to a Page first.");
    }

    const selectionToken = stashUserToken(profile.id, userAccessToken);
    return {
      selectionToken,
      pages: pages.map((p) => ({ id: p.id, name: p.name, hasInstagram: Boolean(p.instagram_business_account?.id) })),
    };
  });
}
