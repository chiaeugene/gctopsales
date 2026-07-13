// Server-side helpers for Meta's OAuth flows: WhatsApp Embedded Signup and
// Facebook Login for Business (Messenger + Instagram). All calls use OUR one
// platform Meta app (META_APP_ID/META_APP_SECRET) — every tenant authorizes
// this same app against their own Page/WABA, so onboarding a new agent never
// needs a new Meta app or manual token hunting.
//
// This only activates once the platform owner has created a real Meta app,
// configured Facebook Login for Business + WhatsApp Embedded Signup, and
// (for use beyond the app's own test users) completed Business Verification
// and App Review — see the setup checklist in DEPLOYMENT.md. Until then,
// the manual paste flow on the Connect page keeps working unaffected.

function apiVersion(): string {
  return process.env.META_API_VERSION || "v21.0";
}

export class MetaOAuthError extends Error {
  constructor(message: string, public detail?: unknown) {
    super(message);
    this.name = "MetaOAuthError";
  }
}

function requireAppCreds(): { appId: string; appSecret: string } {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new MetaOAuthError("Meta app not configured (NEXT_PUBLIC_META_APP_ID / META_APP_SECRET missing).");
  }
  return { appId, appSecret };
}

// Exchanges a Facebook Login for Business / Embedded Signup `code` (obtained
// client-side via FB.login with response_type: "code") for an access token.
// Business Login configurations return a token that behaves as long-lived
// (System User-equivalent) — no separate long-lived-token exchange needed.
export async function exchangeCodeForToken(code: string): Promise<string> {
  const { appId, appSecret } = requireAppCreds();
  const url = new URL(`https://graph.facebook.com/${apiVersion()}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", ""); // JS SDK popup code flow — no redirect involved
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  const json = (await res.json()) as { access_token?: string; error?: unknown };
  if (!res.ok || !json.access_token) {
    throw new MetaOAuthError("Failed to exchange code for token", json.error ?? json);
  }
  return json.access_token;
}

export type FacebookPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
};

// Lists every Page the authorizing user manages, with each Page's own
// (long-lived) access token and linked Instagram professional account, if
// any. One call covers both Messenger and Instagram connect.
export async function listManagedPages(userAccessToken: string): Promise<FacebookPage[]> {
  const url = new URL(`https://graph.facebook.com/${apiVersion()}/me/accounts`);
  url.searchParams.set("fields", "id,name,access_token,instagram_business_account");
  url.searchParams.set("access_token", userAccessToken);

  const res = await fetch(url.toString());
  const json = (await res.json()) as { data?: FacebookPage[]; error?: unknown };
  if (!res.ok || !json.data) {
    throw new MetaOAuthError("Failed to list Facebook Pages", json.error ?? json);
  }
  return json.data;
}

// Subscribes our app to a Page's messaging webhook fields — the step that
// makes Meta actually deliver customer messages to /api/webhooks/meta.
export async function subscribePageWebhook(pageId: string, pageAccessToken: string): Promise<void> {
  const url = new URL(`https://graph.facebook.com/${apiVersion()}/${pageId}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", "messages,messaging_postbacks");
  url.searchParams.set("access_token", pageAccessToken);

  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new MetaOAuthError("Failed to subscribe Page webhook", json);
  }
}

// Subscribes our app to a WhatsApp Business Account's webhook — the WABA
// equivalent of subscribePageWebhook.
export async function subscribeWabaWebhook(wabaId: string, accessToken: string): Promise<void> {
  const url = new URL(`https://graph.facebook.com/${apiVersion()}/${wabaId}/subscribed_apps`);
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new MetaOAuthError("Failed to subscribe WABA webhook", json);
  }
}

// Fetches the WhatsApp phone number's display name/verified name, purely so
// the Connect page can show something friendlier than a raw phone_number_id.
export async function fetchPhoneNumberDisplayName(phoneNumberId: string, accessToken: string): Promise<string | null> {
  const url = new URL(`https://graph.facebook.com/${apiVersion()}/${phoneNumberId}`);
  url.searchParams.set("fields", "display_phone_number,verified_name");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const json = (await res.json()) as { display_phone_number?: string; verified_name?: string };
  if (!res.ok) return null;
  return json.verified_name || json.display_phone_number || null;
}

// Whether the platform's Meta app is configured at all — gates showing the
// one-click connect buttons vs. falling back to manual paste.
export function metaAppConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_META_APP_ID && process.env.META_APP_SECRET);
}
