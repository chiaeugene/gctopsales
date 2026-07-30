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
  // No redirect_uri: the JS SDK popup code flow doesn't use one, and sending
  // an empty value makes Meta hand back a ~1 hour session token.
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  const json = (await res.json()) as { access_token?: string; error?: unknown };
  if (!res.ok || !json.access_token) {
    throw new MetaOAuthError("Failed to exchange code for token", json.error ?? json);
  }
  // Short-lived tokens die in about an hour and take the whole connection with
  // them — always upgrade before storing.
  return upgradeToLongLivedToken(json.access_token);
}

// Trades a short-lived token for a long-lived one (~60 days). Safe to call on
// an already-long-lived token; returns the original if the upgrade is refused.
export async function upgradeToLongLivedToken(token: string): Promise<string> {
  const { appId, appSecret } = requireAppCreds();
  const url = new URL(`https://graph.facebook.com/${apiVersion()}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", token);

  try {
    const res = await fetch(url.toString());
    const json = (await res.json()) as { access_token?: string };
    if (res.ok && json.access_token) return json.access_token;
  } catch {
    // fall through — keep what we have rather than breaking the connect
  }
  return token;
}

// When does this token die? Surfaced in the Connect diagnostic so an expiring
// connection is visible before customers hit silence.
export async function inspectTokenExpiry(
  token: string
): Promise<{ expiresAt: number | null; expiresInDays: number | null; valid: boolean }> {
  const { appId, appSecret } = requireAppCreds();
  const url = new URL(`https://graph.facebook.com/${apiVersion()}/debug_token`);
  url.searchParams.set("input_token", token);
  url.searchParams.set("access_token", `${appId}|${appSecret}`);

  try {
    const res = await fetch(url.toString());
    const json = (await res.json()) as { data?: { expires_at?: number; is_valid?: boolean } };
    const expiresAt = json.data?.expires_at ?? null;
    return {
      expiresAt,
      // expires_at === 0 means "never expires" (system user tokens)
      expiresInDays: expiresAt && expiresAt > 0 ? Math.round((expiresAt * 1000 - Date.now()) / 86_400_000) : null,
      valid: Boolean(json.data?.is_valid),
    };
  } catch {
    return { expiresAt: null, expiresInDays: null, valid: false };
  }
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

// Registers a freshly onboarded phone number with the Cloud API. Numbers
// created through Embedded Signup are NOT usable (no sends, no webhook
// deliveries) until this one-time /register call succeeds — Meta's signup
// success screen says "your partner must register it within 90 days" and WE
// are that partner. The pin is the number's two-step verification PIN; new
// numbers have none, so we set one deterministically.
export async function registerPhoneNumber(phoneNumberId: string, accessToken: string): Promise<{ ok: boolean; detail?: string }> {
  const url = new URL(`https://graph.facebook.com/${apiVersion()}/${phoneNumberId}/register`);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ messaging_product: "whatsapp", pin: "000000" }),
  });
  if (res.ok) return { ok: true };
  const json = (await res.json().catch(() => null)) as { error?: { message?: string; code?: number } } | null;
  const msg = json?.error?.message ?? `HTTP ${res.status}`;
  const code = json?.error?.code;
  // Already-usable numbers report themselves as errors here:
  // - "already registered" (plain)
  // - 133005 PIN mismatch: a two-step PIN only exists on a number that is
  //   already registered (Meta test numbers ship this way), so this is a
  //   success for our purposes, not a failure.
  if (/already/i.test(msg) || code === 133005) {
    return { ok: true, detail: "already registered" };
  }
  return { ok: false, detail: msg };
}

// Creates a real WhatsApp message template on the agent's WhatsApp Business
// Account (this is what whatsapp_business_management is for). Meta reviews the
// template and it becomes sendable once APPROVED — that's the only compliant
// way to reach a customer after the 24h service window closes.
//
// Variable placeholders ({{1}}, {{2}}…) MUST ship with example values or Meta
// rejects the template outright, so we synthesize sensible ones.
const TEMPLATE_EXAMPLES = ["Aisyah", "Total DX+", "1-2 working days", "RM188", "Maybank"];

export async function createMessageTemplate(
  wabaId: string,
  accessToken: string,
  tpl: { name: string; language: string; category: string; bodyText: string }
): Promise<{ ok: boolean; status?: string; metaId?: string; detail?: string }> {
  const varCount = new Set((tpl.bodyText.match(/\{\{\s*\d+\s*\}\}/g) ?? []).map((m) => m.replace(/\D/g, ""))).size;
  const body: Record<string, unknown> = {
    name: tpl.name,
    language: tpl.language || "en",
    category: tpl.category === "UTILITY" ? "UTILITY" : "MARKETING",
    components: [
      {
        type: "BODY",
        text: tpl.bodyText,
        ...(varCount > 0
          ? {
              example: {
                body_text: [Array.from({ length: varCount }, (_, i) => TEMPLATE_EXAMPLES[i] ?? "Sample")],
              },
            }
          : {}),
      },
    ],
  };

  const res = await fetch(`https://graph.facebook.com/${apiVersion()}/${wabaId}/message_templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as {
    id?: string;
    status?: string;
    error?: { message?: string };
  } | null;

  if (!res.ok) return { ok: false, detail: json?.error?.message ?? `HTTP ${res.status}` };
  return { ok: true, status: json?.status ?? "PENDING", metaId: json?.id };
}

// Discovers which WhatsApp Business Accounts a token actually has rights over,
// by asking Meta to introspect the token. Embedded Signup / Business Login
// tokens carry "granular_scopes" listing the exact WABA ids they were granted
// — so we never have to ask the agent to hunt for their WABA id.
export async function discoverWabaIds(accessToken: string): Promise<string[]> {
  const { appId, appSecret } = requireAppCreds();
  const url = new URL(`https://graph.facebook.com/${apiVersion()}/debug_token`);
  url.searchParams.set("input_token", accessToken);
  url.searchParams.set("access_token", `${appId}|${appSecret}`);

  const res = await fetch(url.toString());
  const json = (await res.json()) as {
    data?: { granular_scopes?: { scope?: string; target_ids?: string[] }[] };
  };
  const ids = new Set<string>();
  for (const s of json.data?.granular_scopes ?? []) {
    if (typeof s.scope === "string" && s.scope.startsWith("whatsapp_business")) {
      for (const id of s.target_ids ?? []) ids.add(String(id));
    }
  }
  return [...ids];
}

// Reads a phone number's live state from Meta — the ground truth for "can
// this number actually send/receive?".
export async function fetchPhoneNumberStatus(
  phoneNumberId: string,
  accessToken: string
): Promise<{ ok: boolean; displayPhoneNumber?: string; verifiedName?: string; platform?: string; detail?: string }> {
  const url = new URL(`https://graph.facebook.com/${apiVersion()}/${phoneNumberId}`);
  url.searchParams.set("fields", "display_phone_number,verified_name,platform_type,quality_rating");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const json = (await res.json()) as {
    display_phone_number?: string;
    verified_name?: string;
    platform_type?: string;
    error?: { message?: string };
  };
  if (!res.ok) return { ok: false, detail: json.error?.message ?? `HTTP ${res.status}` };
  return {
    ok: true,
    displayPhoneNumber: json.display_phone_number,
    verifiedName: json.verified_name,
    platform: json.platform_type,
  };
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
