import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

// The link library GC may send in chat. Tenant-scoped on every operation.

export const LINK_KINDS = ["PRODUCT", "REVIEW", "CERT", "CATALOG", "VIDEO", "SHOP", "OTHER"] as const;

export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    const [links, products] = await Promise.all([
      prisma.shareLink.findMany({
        where: { profileId: profile.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.product.findMany({
        where: { profileId: profile.id },
        select: { id: true, name: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);
    return {
      links: links.map((l) => ({
        id: l.id,
        label: l.label,
        url: l.url,
        kind: l.kind,
        note: l.note,
        productId: l.productId,
        isActive: l.isActive,
      })),
      products,
    };
  });
}

const UpsertSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(120),
  // http(s) only — a javascript: or data: URL must never reach a customer's phone.
  url: z
    .string()
    .url()
    .max(1000)
    .refine((u) => /^https?:\/\//i.test(u), "Link must start with http:// or https://"),
  kind: z.enum(LINK_KINDS).optional(),
  note: z.string().max(1000).nullable().optional(),
  productId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = UpsertSchema.safeParse(await req.json());
    if (!body.success) {
      throw new ApiError(400, body.error.issues[0]?.message || "A link needs a name and a valid http(s) URL");
    }
    const d = body.data;

    // A productId from another tenant must not be attachable.
    if (d.productId) {
      const owned = await prisma.product.count({ where: { id: d.productId, profileId: profile.id } });
      if (!owned) throw new ApiError(400, "Unknown product");
    }

    const data = {
      label: d.label.trim(),
      url: d.url.trim(),
      kind: d.kind ?? "OTHER",
      note: d.note?.trim() || null,
      productId: d.productId || null,
      isActive: d.isActive ?? true,
    };

    if (d.id) {
      const { count } = await prisma.shareLink.updateMany({
        where: { id: d.id, profileId: profile.id },
        data,
      });
      if (!count) throw new ApiError(404, "Link not found");
      return { ok: true, id: d.id };
    }

    const n = await prisma.shareLink.count({ where: { profileId: profile.id } });
    const created = await prisma.shareLink.create({ data: { ...data, profileId: profile.id, sortOrder: n } });
    return { ok: true, id: created.id };
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = z.object({ id: z.string() }).safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Missing id");
    await prisma.shareLink.deleteMany({ where: { id: body.data.id, profileId: profile.id } });
    return { ok: true };
  });
}
