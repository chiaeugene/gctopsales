import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { serializeAttachment } from "@/lib/attachments";
import { parseJson, toJson } from "@/lib/json";

export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    const products = await prisma.product.findMany({
      where: { profileId: profile.id },
      orderBy: { sortOrder: "asc" },
      // Metadata only — bytes never leave the byte-serving route.
      include: { attachments: { orderBy: { sortOrder: "asc" }, omit: { data: true } } },
    });
    return {
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        series: p.series,
        priceMemberMyr: p.priceMemberMyr,
        priceRetailMyr: p.priceRetailMyr,
        priceMemberSgd: p.priceMemberSgd,
        priceRetailSgd: p.priceRetailSgd,
        pointValue: p.pointValue,
        boxCount: p.boxCount,
        contents: parseJson<string[]>(p.contents, []),
        gifts: parseJson<string[]>(p.gifts, []),
        description: p.description,
        sellingPoints: p.sellingPoints,
        isActive: p.isActive,
        attachments: p.attachments.map(serializeAttachment),
      })),
    };
  });
}

const UpsertSchema = z.object({
  id: z.string().optional(), // present = update
  name: z.string().min(1).max(300),
  code: z.string().max(50).nullable().optional(),
  series: z.string().max(120).nullable().optional(),
  priceMemberMyr: z.number().min(0),
  priceRetailMyr: z.number().min(0),
  priceMemberSgd: z.number().min(0).nullable().optional(),
  priceRetailSgd: z.number().min(0).nullable().optional(),
  pointValue: z.number().int().min(0).optional(),
  boxCount: z.number().int().min(0).nullable().optional(),
  contents: z.array(z.string()).optional(),
  gifts: z.array(z.string()).optional(),
  description: z.string().max(4000).nullable().optional(),
  sellingPoints: z.string().max(8000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = UpsertSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid product payload");
    const d = body.data;

    const data = {
      name: d.name,
      code: d.code ?? null,
      series: d.series ?? null,
      priceMemberMyr: d.priceMemberMyr,
      priceRetailMyr: d.priceRetailMyr,
      priceMemberSgd: d.priceMemberSgd ?? null,
      priceRetailSgd: d.priceRetailSgd ?? null,
      pointValue: d.pointValue ?? 0,
      boxCount: d.boxCount ?? null,
      contents: toJson(d.contents ?? []),
      gifts: toJson(d.gifts ?? []),
      description: d.description ?? null,
      sellingPoints: d.sellingPoints ?? null,
      isActive: d.isActive ?? true,
    };

    if (d.id) {
      const existing = await prisma.product.findFirst({ where: { id: d.id, profileId: profile.id } });
      if (!existing) throw new ApiError(404, "Product not found");
      await prisma.product.update({ where: { id: existing.id }, data });
      return { id: existing.id };
    }

    const count = await prisma.product.count({ where: { profileId: profile.id } });
    const created = await prisma.product.create({
      data: { ...data, profileId: profile.id, sortOrder: count },
    });
    return { id: created.id };
  });
}

const DeleteSchema = z.object({ id: z.string() });

export async function DELETE(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = DeleteSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");
    const existing = await prisma.product.findFirst({ where: { id: body.data.id, profileId: profile.id } });
    if (!existing) throw new ApiError(404, "Product not found");
    await prisma.product.delete({ where: { id: existing.id } });
    return { ok: true };
  });
}
