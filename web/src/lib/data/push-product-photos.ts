import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { normaliseForWhatsApp } from "@/lib/images";

// Admin-only: give every agent's products a photo GC can actually SEND.
//
// Why this exists: the engine has always supported sending product attachments,
// but no agent had uploaded any, so GC was quoting RM488 with no visual at all —
// which reads as a scam to a chat buyer. This pushes the real MAE product-line
// photography already bundled in /public/mae into ProductImage rows so GC has
// something to send from day one. Agents should still upload their own, better
// shots per SKU; this is the floor, not the ceiling.
//
// Idempotent: a product that already has an attachment is left alone.
const SERIES_FILE: Record<string, { file: string; label: string }> = {
  "BCODE+": { file: "product-bcode.webp", label: "BCODE+ set" },
  "Claríty Skincare": { file: "product-skincare.webp", label: "Claríty skincare" },
  "Claríty Anti-Aging": { file: "product-skincare.webp", label: "Claríty Anti-Aging duo" },
  "Healthcare (Total DX+)": { file: "product-detox.webp", label: "Total DX+" },
  "BRB (Mental Wellness)": { file: "product-brb.webp", label: "BRB" },
  "Re.WIND Hair": { file: "product-hair.webp", label: "Re.WIND hair range" },
  "iReason Eye Health": { file: "product-bcode.webp", label: "iReason" },
};

export type PhotoPushReport = {
  created: number;
  alreadyHad: number;
  noMapping: number;
  unmappedSeries: string[];
};

export async function pushProductPhotos(prisma: PrismaClient): Promise<PhotoPushReport> {
  // Read each distinct file once, not once per product — 26 products across a
  // handful of series would otherwise re-read the same bytes repeatedly.
  const cache = new Map<string, Uint8Array<ArrayBuffer>>();
  const bytesFor = async (file: string): Promise<Uint8Array<ArrayBuffer> | null> => {
    if (cache.has(file)) return cache.get(file)!;
    try {
      const raw = await readFile(path.join(process.cwd(), "public", "mae", file));
      // Prisma Bytes wants a plain Uint8Array over a real ArrayBuffer.
      const buf = new Uint8Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)) as Uint8Array<ArrayBuffer>;
      cache.set(file, buf);
      return buf;
    } catch {
      return null;
    }
  };

  const products = await prisma.product.findMany({
    select: { id: true, profileId: true, name: true, series: true, _count: { select: { attachments: true } } },
  });

  let created = 0;
  let alreadyHad = 0;
  let noMapping = 0;
  const unmapped = new Set<string>();

  for (const p of products) {
    if (p._count.attachments > 0) {
      alreadyHad++;
      continue;
    }
    const mapping = p.series ? SERIES_FILE[p.series] : undefined;
    if (!mapping) {
      noMapping++;
      if (p.series) unmapped.add(p.series);
      continue;
    }
    const rawBytes = await bytesFor(mapping.file);
    // The bundled MAE artwork is WEBP, which WhatsApp refuses to send.
    const data = rawBytes ? (await normaliseForWhatsApp(rawBytes, "image/webp", mapping.file)).data : null;
    if (!data) {
      noMapping++;
      continue;
    }
    await prisma.productImage.create({
      data: {
        profileId: p.profileId,
        productId: p.id,
        fileName: mapping.file.replace(/\.[^.]+$/, ".jpg"),
        // The label is what GC reads to decide whether this file fits the
        // moment, so it has to describe the picture, not the filename.
        label: `${mapping.label} product photo`,
        fileType: "PHOTO",
        mimeType: "image/jpeg",
        data,
        sizeBytes: data.byteLength,
        sortOrder: 0,
      },
    });
    created++;
  }

  return { created, alreadyHad, noMapping, unmappedSeries: [...unmapped] };
}
