import crypto from "node:crypto";

// Verifies Meta's X-Hub-Signature-256 header against the raw request body.
// Must run on the *raw* body (before any JSON.parse) — the signature is
// computed over the exact bytes Meta sent. Rejects forged/tampered webhook
// deliveries; this is the only thing standing between the public internet
// and "pretend to be a customer messaging any tenant". One app secret covers
// all tenants because all tenants' channels are subscribed through our one
// Meta app.
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null | undefined): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;

  const expectedHex = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : signatureHeader;

  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(provided, "hex");
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

// Real Meta webhook payloads are a few KB at most. Webhook endpoints are
// public and unauthenticated until the signature check runs, so they're the
// one place in the app reachable by anyone on the internet — without a cap,
// `req.text()` buffers an attacker-supplied body of any size into memory,
// which OOM-crashed Mandy's server rather than just the route.
export const MAX_WEBHOOK_BODY_BYTES = 256 * 1024; // 256KB

// Streams the body in with a hard byte cap instead of buffering it all via
// req.text() first — rejects oversized payloads before they're fully read,
// and doesn't trust a declared Content-Length alone (can be missing/wrong).
export async function readBodyWithLimit(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_WEBHOOK_BODY_BYTES) return null;

  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_WEBHOOK_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf-8");
}
