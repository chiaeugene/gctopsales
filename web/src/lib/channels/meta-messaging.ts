import { resolveSendableAttachmentMeta, type SendableFileMeta } from "@/lib/attachments";

// Facebook Messenger + Instagram DM Send API client. Both channels share the
// same Send API shape (POST /{page-id}/messages with a page access token);
// Instagram messaging rides on the connected Facebook Page.
// Multi-tenant: credentials come from the tenant's ChannelConnection row.
//
// Same discipline as the WhatsApp client: failures are logged and swallowed,
// never thrown.

export type MetaMessagingCreds = { pageId: string; accessToken: string };

const MAX_ATTACHMENTS_PER_MESSAGE = 4;

function apiVersion(): string {
  return process.env.META_API_VERSION || "v21.0";
}

export async function sendMetaText(creds: MetaMessagingCreds, recipientId: string, text: string): Promise<void> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion()}/${creds.pageId}/messages?access_token=${encodeURIComponent(creds.accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          messaging_type: "RESPONSE",
          message: { text },
        }),
      }
    );
    if (!res.ok) {
      console.error("[meta-messaging] sendMetaText failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("[meta-messaging] sendMetaText error", err);
  }
}

// Messenger/IG attachments are sent by URL — we point Meta at our own
// byte-serving route. Requires PUBLIC_BASE_URL to be set (the app's public
// https origin); silently skips otherwise (text still goes out).
export async function sendMetaAttachmentsByIds(
  creds: MetaMessagingCreds,
  recipientId: string,
  attachmentIds: string[]
): Promise<void> {
  const baseUrl = process.env.PUBLIC_BASE_URL;
  if (!baseUrl) {
    if (attachmentIds.length) {
      console.error("[meta-messaging] PUBLIC_BASE_URL not set — cannot send attachments by URL.");
    }
    return;
  }
  for (const id of attachmentIds.slice(0, MAX_ATTACHMENTS_PER_MESSAGE)) {
    const attachment = await resolveSendableAttachmentMeta(id);
    if (!attachment) continue;
    await sendMetaAttachmentUrl(creds, recipientId, attachment, `${baseUrl}/api/attachments/${id}/public`);
  }
}

async function sendMetaAttachmentUrl(
  creds: MetaMessagingCreds,
  recipientId: string,
  attachment: SendableFileMeta,
  url: string
): Promise<void> {
  try {
    const type = attachment.fileType === "PHOTO" ? "image" : "file";
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion()}/${creds.pageId}/messages?access_token=${encodeURIComponent(creds.accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          messaging_type: "RESPONSE",
          message: { attachment: { type, payload: { url, is_reusable: true } } },
        }),
      }
    );
    if (!res.ok) {
      console.error("[meta-messaging] attachment send failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("[meta-messaging] attachment send error", err);
  }
}

// Downloads a customer-sent image from a Messenger/IG webhook attachment URL
// (these are pre-signed CDN links — no auth header needed). Best-effort.
export async function fetchMetaMediaBytes(
  url: string
): Promise<{ data: Uint8Array<ArrayBuffer>; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("[meta-messaging] media download failed", res.status);
      return null;
    }
    const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
    const data = new Uint8Array(await res.arrayBuffer()) as Uint8Array<ArrayBuffer>;
    return { data, mimeType };
  } catch (err) {
    console.error("[meta-messaging] fetchMetaMediaBytes error (non-fatal)", err);
    return null;
  }
}
