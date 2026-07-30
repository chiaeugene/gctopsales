import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { fetchMessageTemplates, discoverWabaIds } from "@/lib/meta-oauth";

// Pulls the real approval statuses from Meta onto this profile's templates.
// Replaces the old (dangerous) manual status dropdown: only Meta can say
// whether a template is APPROVED, and campaigns depend on that being true.
// Also imports any template that exists on the WABA but not here yet.
export async function POST() {
  return handle(async () => {
    const profile = await requireProfile();

    const connection = await prisma.channelConnection.findFirst({
      where: { profileId: profile.id, channel: "WHATSAPP", isActive: true },
    });
    if (!connection) throw new ApiError(400, "Connect WhatsApp first — statuses live on your WhatsApp account.");

    const wabaIds = await discoverWabaIds(connection.accessToken);
    if (wabaIds.length === 0) throw new ApiError(400, "No manageable WhatsApp account on this connection.");

    const remote = await fetchMessageTemplates(wabaIds[0], connection.accessToken);
    if (!remote.ok) throw new ApiError(502, remote.detail ?? "Could not read templates from WhatsApp");

    const local = await prisma.messageTemplate.findMany({ where: { profileId: profile.id } });
    const localByName = new Map(local.map((t) => [t.name, t]));

    let updated = 0;
    let imported = 0;
    for (const r of remote.templates) {
      const status = ["APPROVED", "REJECTED", "PENDING"].includes(r.status) ? r.status : "PENDING";
      const existing = localByName.get(r.name);
      if (existing) {
        if (existing.status !== status) {
          await prisma.messageTemplate.update({ where: { id: existing.id }, data: { status } });
          updated++;
        }
      } else {
        // Template created outside GC (or before it) — bring it in so campaigns
        // can use it, body text left blank for the agent to fill if they want.
        await prisma.messageTemplate.create({
          data: {
            profileId: profile.id,
            name: r.name,
            language: r.language || "en",
            category: "MARKETING",
            bodyText: "(created in WhatsApp Manager — open in Meta to view the body)",
            status,
          },
        });
        imported++;
      }
    }

    return { checked: remote.templates.length, updated, imported };
  }, "templates/sync");
}
