import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import LIBRARY_MANIFEST from "@/lib/data/library-manifest.json";

// Pushes the curated MAE proof library (certificates, infographics, extra
// product shots) into every agent's MediaAsset library, so a new agent starts
// with something to show a customer instead of an empty Library page.
//
// The files themselves live in public/mae/library/ and are committed, so this is
// reproducible and versioned — no runtime dependency on MAE's CDN staying up or
// on an agent's network.
//
// Idempotent by (profileId, label): re-running adds only what's new and never
// touches an agent's own uploads.

export type LibraryManifestEntry = {
  kind: string;
  file: string;
  label: string;
  note: string;
  // Which product series this belongs to, or "GENERAL" for brand-wide assets
  // like a company halal certificate.
  productLine: string;
};

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export type LibraryPushReport = {
  profiles: number;
  created: number;
  skipped: number;
  missingFiles: string[];
};

export async function pushLibraryAssets(prisma: PrismaClient): Promise<LibraryPushReport> {
  const entries = LIBRARY_MANIFEST as LibraryManifestEntry[];
  const profiles = await prisma.storeProfile.findMany({ select: { id: true } });

  // Read each file once for the whole run, not once per profile.
  const bytes = new Map<string, { data: Uint8Array<ArrayBuffer>; mimeType: string }>();
  const missingFiles: string[] = [];
  for (const e of entries) {
    if (bytes.has(e.file) || missingFiles.includes(e.file)) continue;
    const ext = path.extname(e.file).toLowerCase();
    const mimeType = MIME_BY_EXT[ext];
    if (!mimeType) {
      missingFiles.push(e.file);
      continue;
    }
    try {
      const raw = await readFile(path.join(process.cwd(), "public", "mae", "library", e.file));
      // Prisma Bytes wants a Uint8Array over a real ArrayBuffer.
      const data = new Uint8Array(
        raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
      ) as Uint8Array<ArrayBuffer>;
      bytes.set(e.file, { data, mimeType });
    } catch {
      missingFiles.push(e.file);
    }
  }

  let created = 0;
  let skipped = 0;

  for (const p of profiles) {
    const [existing, products] = await Promise.all([
      prisma.mediaAsset.findMany({ where: { profileId: p.id }, select: { label: true } }),
      prisma.product.findMany({ where: { profileId: p.id }, select: { id: true, name: true, series: true } }),
    ]);
    const have = new Set(existing.map((a) => a.label));
    let sort = existing.length;

    for (const e of entries) {
      const file = bytes.get(e.file);
      if (!file) continue;
      if (have.has(e.label)) {
        skipped++;
        continue;
      }
      // Scope to a product only when the line maps to one this agent sells;
      // otherwise leave it general so it's still offerable.
      const productId =
        e.productLine === "GENERAL"
          ? null
          : (products.find((pr) => (pr.series ?? "").toLowerCase().includes(e.productLine.toLowerCase()))?.id ?? null);

      await prisma.mediaAsset.create({
        data: {
          profileId: p.id,
          kind: e.kind,
          label: e.label,
          note: e.note,
          productId,
          fileName: e.file,
          fileType: file.mimeType === "application/pdf" ? "PDF" : "PHOTO",
          mimeType: file.mimeType,
          data: file.data,
          sizeBytes: file.data.byteLength,
          isActive: true,
          sortOrder: sort++,
        },
      });
      created++;
    }
  }

  return { profiles: profiles.length, created, skipped, missingFiles };
}
