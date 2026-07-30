import type { PrismaClient } from "@prisma/client";
import { TESTIMONIAL_BANK } from "@/lib/data/testimonial-bank";

// Pushes the curated MAE results bank (real, grounded customer results) into
// every agent's testimonial library so GC has social proof for each product
// category from day one. Idempotent — an entry whose resultText already exists
// on a profile is skipped, and agents' own testimonials are never touched.
//
// Lives here rather than inline in the route so a one-off maintenance run and
// the Admin button execute the exact same logic, with no chance of drift.
//
// Category → product matching, and why it needs care: the Results page groups
// by product SERIES, so a bank entry that matches no product lands with a null
// productId and disappears into "General / brand" instead of its category.
// `any` = match if the product name or series contains any of these.
// `not`  = reject the product if it contains any of these (stops plain
//          "Claríty" results from attaching to Claríty ANTI-AGING products,
//          since both series contain the word and the matcher would otherwise
//          take whichever sorted first).
export const CATEGORY_MATCH: Record<string, { any: string[]; not?: string[] }> = {
  "BCODE+": { any: ["bcode", "b-actv", "b-vtra", "b-orig"] },
  "Total DX+": { any: ["total dx", "dx+"] },
  // B-SynN is one of the four BCODE+ codes, not a series of its own, so no
  // product is ever literally named "B-SynN" — fall back to BCODE+ where these
  // results commercially belong.
  "B-SynN": { any: ["b-synn", "synn", "bcode"] },
  BRB: { any: ["brb"] },
  "Claríty": { any: ["clarity", "claríty"], not: ["anti-aging", "anti aging"] },
  "Claríty Anti-Aging": { any: ["anti-aging", "anti aging", "rep1"] },
  "Re.WIND": { any: ["re.wind", "rewind"] },
  iReason: { any: ["ireason"] },
};

export type SeedResultsReport = {
  profiles: number;
  created: number;
  skipped: number;
  noCatalog: number;
  unmatchedCategories: string[];
};

export async function seedResultsBank(prisma: PrismaClient): Promise<SeedResultsReport> {
  const profiles = await prisma.storeProfile.findMany({ select: { id: true } });

  let created = 0;
  let skipped = 0;
  let noCatalog = 0;
  const unmatched = new Set<string>();

  for (const p of profiles) {
    const [products, existing] = await Promise.all([
      prisma.product.findMany({ where: { profileId: p.id }, select: { id: true, name: true, series: true } }),
      prisma.testimonial.findMany({ where: { profileId: p.id }, select: { resultText: true } }),
    ]);
    const existingTexts = new Set(existing.map((t) => t.resultText));

    // Results attach to products. Seeding a profile with no catalog would
    // create rows that can never be grouped, so skip it and report it — the
    // admin needs to push the catalog to that agent first.
    if (!products.length) {
      noCatalog++;
      continue;
    }

    const productFor = (category: string): string | null => {
      const rule = CATEGORY_MATCH[category] ?? { any: [category.toLowerCase()] };
      const hit = products.find((prod) => {
        const hay = `${prod.name} ${prod.series ?? ""}`.toLowerCase();
        if (rule.not?.some((k) => hay.includes(k))) return false;
        return rule.any.some((k) => hay.includes(k));
      });
      return hit?.id ?? null;
    };

    let sort = existing.length;
    for (const entry of TESTIMONIAL_BANK) {
      if (existingTexts.has(entry.resultText)) {
        skipped++;
        continue;
      }
      const productId = productFor(entry.category);
      if (!productId) unmatched.add(entry.category);
      await prisma.testimonial.create({
        data: {
          profileId: p.id,
          productId,
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

  return { profiles: profiles.length, created, skipped, noCatalog, unmatchedCategories: [...unmatched] };
}
