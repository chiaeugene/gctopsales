import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { parseJson, toJson } from "@/lib/json";
import { CatalogRulesSchema } from "@/lib/ai/schemas";

// Admin pushes their master catalog to every agent. The admin's own
// StoreProfile is the master. Sync is by MAE product `code`, so:
//   - existing agent products (matched by code) get canonical fields updated
//     (name, prices, contents, gifts, notes) — the agent's own attachments and
//     their active/inactive toggle are PRESERVED.
//   - new master products the agent doesn't have get created.
//   - products the agent added themselves (no matching master code) are left
//     untouched — agents keep self-managing.
// Agents can still edit everything afterward; the next push re-syncs the
// canonical fields. This gives admin central control + agent autonomy.

const Schema = z.object({
  products: z.boolean().default(true),
  currentPromotions: z.boolean().default(false),
});

const CANONICAL_KEYS = [
  "name",
  "series",
  "priceMemberMyr",
  "priceRetailMyr",
  "priceMemberSgd",
  "priceRetailSgd",
  "pointValue",
  "boxCount",
  "contents",
  "gifts",
  "description",
  "sellingPoints",
  "sortOrder",
] as const;

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const body = Schema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) throw new ApiError(400, "Invalid payload");

    const master = await prisma.storeProfile.findUnique({
      where: { userId: admin.id },
      include: { products: { orderBy: { sortOrder: "asc" } } },
    });
    if (!master) throw new ApiError(400, "Admin has no master catalog profile");

    const agents = await prisma.storeProfile.findMany({
      where: { id: { not: master.id } },
      include: { products: true },
    });

    let productsSynced = 0;
    let agentsUpdated = 0;

    const masterPromo = CatalogRulesSchema.parse(parseJson(master.catalogRules, {})).currentPromotions || "";

    for (const agent of agents) {
      let touched = false;

      if (body.data.products) {
        const byCode = new Map(agent.products.filter((p) => p.code).map((p) => [p.code!, p]));
        for (const mp of master.products) {
          if (!mp.code) continue; // only sync coded products (safe matching)
          const canonical: Record<string, unknown> = {};
          for (const k of CANONICAL_KEYS) canonical[k] = (mp as Record<string, unknown>)[k];
          const existing = byCode.get(mp.code);
          if (existing) {
            await prisma.product.update({ where: { id: existing.id }, data: canonical });
          } else {
            await prisma.product.create({
              data: { ...(canonical as object), profileId: agent.id, code: mp.code, isActive: true } as never,
            });
          }
          productsSynced++;
          touched = true;
        }
      }

      if (body.data.currentPromotions) {
        const cr = CatalogRulesSchema.parse(parseJson(agent.catalogRules, {}));
        await prisma.storeProfile.update({
          where: { id: agent.id },
          data: { catalogRules: toJson({ ...cr, currentPromotions: masterPromo }) },
        });
        touched = true;
      }

      if (touched) agentsUpdated++;
    }

    return { agentsUpdated, productsSynced, agentCount: agents.length };
  });
}
