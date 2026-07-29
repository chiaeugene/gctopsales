import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { TESTIMONIAL_BANK } from "@/lib/data/testimonial-bank";

// Admin-only: push the curated MAE results bank (real, grounded customer
// results) into every agent's testimonial library so GC has social proof for
// each product category from day one. Idempotent — an entry whose resultText
// already exists on a profile is skipped, and agents' own testimonials are
// never touched. Category → product matching is by name/series keyword.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "BCODE+": ["bcode", "b-actv", "b-vtra", "b-orig"],
  "Total DX+": ["total dx", "dx+"],
  "B-SynN": ["b-synn", "synn"],
  BRB: ["brb"],
  "Claríty": ["clarity", "claríty"],
  "Claríty Anti-Aging": ["anti-aging", "anti aging", "rep1"],
  "Re.WIND": ["re.wind", "rewind"],
  iReason: ["ireason"],
};

export async function POST() {
  return handle(async () => {
    await requireAdmin();
    const profiles = await prisma.storeProfile.findMany({ select: { id: true } });

    let created = 0;
    let skipped = 0;
    for (const p of profiles) {
      const [products, existing] = await Promise.all([
        prisma.product.findMany({ where: { profileId: p.id }, select: { id: true, name: true, series: true } }),
        prisma.testimonial.findMany({ where: { profileId: p.id }, select: { resultText: true } }),
      ]);
      const existingTexts = new Set(existing.map((t) => t.resultText));

      const productFor = (category: string): string | null => {
        const keys = CATEGORY_KEYWORDS[category] ?? [category.toLowerCase()];
        const hit = products.find((prod) =>
          keys.some((k) => prod.name.toLowerCase().includes(k) || (prod.series ?? "").toLowerCase().includes(k))
        );
        return hit?.id ?? null;
      };

      let sort = existing.length;
      for (const entry of TESTIMONIAL_BANK) {
        if (existingTexts.has(entry.resultText)) {
          skipped++;
          continue;
        }
        await prisma.testimonial.create({
          data: {
            profileId: p.id,
            productId: productFor(entry.category),
            customerName: entry.customerName,
            market: ["MY", "SG", "BN", "HK"].includes(entry.market) ? entry.market : "MY",
            resultText: entry.resultText,
            rating: entry.rating === 4 || entry.rating === 5 ? entry.rating : 5,
            isActive: true,
            sortOrder: sort++,
          },
        });
        created++;
      }
    }

    return { profiles: profiles.length, created, skipped };
  });
}
