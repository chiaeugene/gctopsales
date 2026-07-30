import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TO_TYPE, MEDIA_ASSET_PREFIX } from "@/lib/attachments";

// The standalone library of files GC may send: certificates, delivery proof,
// price cards, label close-ups. Tenant-scoped on every operation, and bytes are
// never returned by the list endpoint (loading every file's payload to render a
// list is the OOM pattern this codebase has been bitten by before).

export const ASSET_KINDS = ["CERT", "DELIVERY", "PRICE_CARD", "LABEL", "PRODUCT", "TEAM", "OTHER"] as const;

export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    const [assets, products] = await Promise.all([
      prisma.mediaAsset.findMany({
        where: { profileId: profile.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        omit: { data: true },
      }),
      prisma.product.findMany({
        where: { profileId: profile.id },
        select: { id: true, name: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);
    return {
      assets: assets.map((a) => ({
        id: a.id,
        kind: a.kind,
        label: a.label,
        note: a.note,
        productId: a.productId,
        fileName: a.fileName,
        fileType: a.fileType,
        sizeBytes: a.sizeBytes,
        isActive: a.isActive,
        // Same authenticated byte-serving route as every other attachment.
        url: `/api/attachments/${MEDIA_ASSET_PREFIX}${a.id}`,
      })),
      products,
    };
  });
}

// POST is multipart: the file plus its metadata in one go, so an agent never
// ends up with an unlabelled file GC can't decide about.
export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const form = await req.formData();

    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "No file uploaded");
    if (file.size > ATTACHMENT_MAX_BYTES) {
      throw new ApiError(400, `File is too large (max ${Math.round(ATTACHMENT_MAX_BYTES / 1024 / 1024)}MB)`);
    }
    const fileType = ATTACHMENT_MIME_TO_TYPE[file.type];
    if (!fileType) throw new ApiError(400, "Only JPG, PNG, WEBP images or PDF files are supported");

    const meta = z
      .object({
        kind: z.enum(ASSET_KINDS).optional(),
        label: z.string().min(1).max(160),
        note: z.string().max(1000).optional(),
        productId: z.string().optional(),
      })
      .safeParse({
        kind: (form.get("kind") as string) || undefined,
        label: (form.get("label") as string) || "",
        note: (form.get("note") as string) || undefined,
        productId: (form.get("productId") as string) || undefined,
      });
    if (!meta.success) throw new ApiError(400, "Every file needs a short label saying what it shows");

    // A productId from another tenant must not be attachable.
    if (meta.data.productId) {
      const owned = await prisma.product.count({ where: { id: meta.data.productId, profileId: profile.id } });
      if (!owned) throw new ApiError(400, "Unknown product");
    }

    const data = new Uint8Array(await file.arrayBuffer());
    const n = await prisma.mediaAsset.count({ where: { profileId: profile.id } });
    const created = await prisma.mediaAsset.create({
      data: {
        profileId: profile.id,
        kind: meta.data.kind ?? "OTHER",
        label: meta.data.label.trim(),
        note: meta.data.note?.trim() || null,
        productId: meta.data.productId || null,
        fileName: file.name || "upload",
        fileType,
        mimeType: file.type,
        data,
        sizeBytes: data.byteLength,
        sortOrder: n,
      },
      omit: { data: true },
    });
    return { ok: true, id: created.id };
  });
}

// PATCH edits metadata only — the file itself is replaced by deleting and
// re-uploading, which keeps this endpoint small and the bytes path in one place.
const PatchSchema = z.object({
  id: z.string(),
  kind: z.enum(ASSET_KINDS).optional(),
  label: z.string().min(1).max(160).optional(),
  note: z.string().max(1000).nullable().optional(),
  productId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = PatchSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid asset update");
    const { id, ...rest } = body.data;

    if (rest.productId) {
      const owned = await prisma.product.count({ where: { id: rest.productId, profileId: profile.id } });
      if (!owned) throw new ApiError(400, "Unknown product");
    }

    const data: Record<string, unknown> = {};
    if (rest.kind !== undefined) data.kind = rest.kind;
    if (rest.label !== undefined) data.label = rest.label.trim();
    if (rest.note !== undefined) data.note = rest.note?.trim() || null;
    if (rest.productId !== undefined) data.productId = rest.productId || null;
    if (rest.isActive !== undefined) data.isActive = rest.isActive;

    const { count } = await prisma.mediaAsset.updateMany({ where: { id, profileId: profile.id }, data });
    if (!count) throw new ApiError(404, "Asset not found");
    return { ok: true };
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = z.object({ id: z.string() }).safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Missing id");
    await prisma.mediaAsset.deleteMany({ where: { id: body.data.id, profileId: profile.id } });
    return { ok: true };
  });
}
