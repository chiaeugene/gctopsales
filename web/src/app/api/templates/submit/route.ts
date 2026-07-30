import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { createMessageTemplate, discoverWabaIds } from "@/lib/meta-oauth";

// Submits one of the agent's templates to Meta for approval, on their own
// WhatsApp Business Account. Uses whatsapp_business_management. The WABA id is
// discovered from the stored token, so the agent only clicks a button.
const BodySchema = z.object({ id: z.string().min(1) });

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = BodySchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");

    const template = await prisma.messageTemplate.findFirst({
      where: { id: body.data.id, profileId: profile.id },
    });
    if (!template) throw new ApiError(404, "Template not found");

    const connection = await prisma.channelConnection.findFirst({
      where: { profileId: profile.id, channel: "WHATSAPP", isActive: true },
    });
    if (!connection) {
      throw new ApiError(400, "Connect WhatsApp first (Connect page) — templates live on your WhatsApp account.");
    }

    const wabaIds = await discoverWabaIds(connection.accessToken);
    if (wabaIds.length === 0) {
      throw new ApiError(
        400,
        "Your WhatsApp connection has no manageable business account. Reconnect on the Connect page, then try again."
      );
    }

    const result = await createMessageTemplate(wabaIds[0], connection.accessToken, {
      name: template.name,
      language: template.language,
      category: template.category,
      bodyText: template.bodyText,
    });
    console.log("[templates submit]", template.name, JSON.stringify(result));

    if (!result.ok) throw new ApiError(502, result.detail ?? "Meta rejected the template");

    // Meta's own status wins — usually PENDING until a human reviews it.
    const status = result.status === "APPROVED" ? "APPROVED" : result.status === "REJECTED" ? "REJECTED" : "PENDING";
    await prisma.messageTemplate.update({ where: { id: template.id }, data: { status } });

    return { ok: true, status, metaId: result.metaId ?? null, wabaId: wabaIds[0] };
  }, "templates/submit");
}
