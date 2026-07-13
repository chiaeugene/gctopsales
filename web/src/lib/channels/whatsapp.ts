import { resolveSendableAttachment, type SendableFile } from "@/lib/attachments";

// WhatsApp Cloud API client. Multi-tenant: every call takes the tenant's own
// credentials (from their ChannelConnection row) — there is no global token.
//
// Outbound Graph API calls: failures are logged and swallowed, never thrown —
// a failed send must never break the webhook's required fast 200 response
// back to Meta (Meta retries deliveries aggressively on non-200/slow
// responses, which would otherwise cause duplicate processing).

export type WhatsAppCreds = { phoneNumberId: string; accessToken: string };

// Defensive ceiling on how many files GC can send in one reply.
const MAX_ATTACHMENTS_PER_MESSAGE = 4;

function apiVersion(): string {
  return process.env.META_API_VERSION || "v21.0";
}

function apiBase(phoneNumberId: string): string {
  return `https://graph.facebook.com/${apiVersion()}/${phoneNumberId}`;
}

export async function sendWhatsAppText(creds: WhatsAppCreds, to: string, text: string): Promise<void> {
  try {
    const res = await fetch(`${apiBase(creds.phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
    if (!res.ok) {
      console.error("[whatsapp] sendWhatsAppText failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("[whatsapp] sendWhatsAppText error", err);
  }
}

// Sends an approved WhatsApp template message — the ONLY way to message a
// customer outside the 24h customer-service window (used by re-engagement
// campaigns for cold leads). `bodyParams` fill the template's {{1}},{{2}}…
// body variables in order. Returns true on success.
export async function sendWhatsAppTemplate(
  creds: WhatsAppCreds,
  to: string,
  templateName: string,
  language: string,
  bodyParams: string[]
): Promise<boolean> {
  try {
    const components =
      bodyParams.length > 0
        ? [{ type: "body", parameters: bodyParams.map((t) => ({ type: "text", text: t })) }]
        : [];
    const res = await fetch(`${apiBase(creds.phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: language },
          ...(components.length ? { components } : {}),
        },
      }),
    });
    if (!res.ok) {
      console.error("[whatsapp] sendWhatsAppTemplate failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[whatsapp] sendWhatsAppTemplate error", err);
    return false;
  }
}

// Uploads an attachment's bytes to Meta's Media API, then sends it as an
// image or document message referencing the returned media id. `attachment`
// may be a product file or a testimonial before/after photo — both resolve
// to the same shape via resolveSendableAttachment.
export async function sendWhatsAppAttachment(
  creds: WhatsAppCreds,
  to: string,
  attachment: SendableFile
): Promise<void> {
  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append(
      "file",
      new Blob([new Uint8Array(attachment.data)], { type: attachment.mimeType }),
      attachment.fileName
    );

    const uploadRes = await fetch(`${apiBase(creds.phoneNumberId)}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.accessToken}` },
      body: form,
    });
    if (!uploadRes.ok) {
      console.error("[whatsapp] media upload failed", uploadRes.status, await uploadRes.text());
      return;
    }
    const { id: mediaId } = (await uploadRes.json()) as { id: string };

    const isImage = attachment.fileType === "PHOTO";
    const sendRes = await fetch(`${apiBase(creds.phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: isImage ? "image" : "document",
        [isImage ? "image" : "document"]: isImage
          ? { id: mediaId }
          : { id: mediaId, filename: attachment.fileName },
      }),
    });
    if (!sendRes.ok) {
      console.error("[whatsapp] sendWhatsAppAttachment failed", sendRes.status, await sendRes.text());
    }
  } catch (err) {
    console.error("[whatsapp] sendWhatsAppAttachment error", err);
  }
}

// Sends a set of product attachments by id, loading each file's bytes ONE AT
// A TIME (not all at once) so peak memory is a single file — batching large
// PDFs would reintroduce the load-everything-into-memory pattern that
// OOM-crashed Mandy's server.
export async function sendWhatsAppAttachmentsByIds(
  creds: WhatsAppCreds,
  to: string,
  attachmentIds: string[]
): Promise<void> {
  for (const id of attachmentIds.slice(0, MAX_ATTACHMENTS_PER_MESSAGE)) {
    const attachment = await resolveSendableAttachment(id);
    if (attachment) await sendWhatsAppAttachment(creds, to, attachment);
  }
}

// Downloads a customer-sent media item (e.g. a payment-proof photo). Meta's
// media API is a two-step fetch: the webhook only gives you a media id, which
// resolves to a short-lived download url + mime type, which you then fetch
// with the same bearer token. Best-effort — never throws.
export async function fetchWhatsAppMediaBytes(
  creds: WhatsAppCreds,
  mediaId: string
): Promise<{ data: Uint8Array<ArrayBuffer>; mimeType: string } | null> {
  try {
    const metaRes = await fetch(`https://graph.facebook.com/${apiVersion()}/${mediaId}`, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    if (!metaRes.ok) {
      console.error("[whatsapp] media metadata fetch failed", metaRes.status, await metaRes.text());
      return null;
    }
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url || !meta.mime_type) return null;

    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${creds.accessToken}` } });
    if (!fileRes.ok) {
      console.error("[whatsapp] media download failed", fileRes.status);
      return null;
    }
    const data = new Uint8Array(await fileRes.arrayBuffer()) as Uint8Array<ArrayBuffer>;
    return { data, mimeType: meta.mime_type };
  } catch (err) {
    console.error("[whatsapp] fetchWhatsAppMediaBytes error (non-fatal)", err);
    return null;
  }
}
