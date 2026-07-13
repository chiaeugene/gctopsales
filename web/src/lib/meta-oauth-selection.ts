import crypto from "node:crypto";

// Short-lived, in-memory holding pen for a user access token between "list
// this agent's Pages" and "finalize with the Page they picked" — needed
// because the OAuth `code` is single-use, so we can't just re-exchange it on
// the second call. Never sent to the browser; only an opaque selectionToken
// is. Fine for a single-instance deployment (this app runs one web
// instance); would need a shared store (Redis) if scaled to multiple.
const TTL_MS = 5 * 60 * 1000;
const store = new Map<string, { profileId: string; userAccessToken: string; expiresAt: number }>();

function sweep() {
  const now = Date.now();
  for (const [token, entry] of store) {
    if (entry.expiresAt < now) store.delete(token);
  }
}

export function stashUserToken(profileId: string, userAccessToken: string): string {
  sweep();
  const selectionToken = crypto.randomBytes(24).toString("hex");
  store.set(selectionToken, { profileId, userAccessToken, expiresAt: Date.now() + TTL_MS });
  return selectionToken;
}

// Consumes (single-use) the stashed token — returns null if missing,
// expired, or requested by a different tenant than stashed it.
export function takeUserToken(selectionToken: string, profileId: string): string | null {
  sweep();
  const entry = store.get(selectionToken);
  if (!entry) return null;
  store.delete(selectionToken);
  if (entry.profileId !== profileId) return null;
  return entry.userAccessToken;
}
