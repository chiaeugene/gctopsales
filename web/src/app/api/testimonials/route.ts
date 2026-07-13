import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    const testimonials = await prisma.testimonial.findMany({
      where: { profileId: profile.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { product: { select: { id: true, name: true } } },
    });
    return {
      testimonials: testimonials.map((t) => ({
        id: t.id,
        productId: t.productId,
        productName: t.product?.name ?? null,
        customerName: t.customerName,
        market: t.market,
        resultText: t.resultText,
        rating: t.rating,
        isActive: t.isActive,
      })),
    };
  });
}

const UpsertSchema = z.object({
  id: z.string().optional(),
  productId: z.string().nullable().optional(),
  customerName: z.string().max(120).nullable().optional(),
  market: z.enum(["MY", "SG", "BN"]).nullable().optional(),
  resultText: z.string().min(3).max(1000),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = UpsertSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid testimonial payload");
    const d = body.data;

    // Validate the product belongs to this tenant, if given.
    if (d.productId) {
      const p = await prisma.product.findFirst({ where: { id: d.productId, profileId: profile.id } });
      if (!p) throw new ApiError(400, "Unknown product");
    }

    const data = {
      productId: d.productId ?? null,
      customerName: d.customerName ?? null,
      market: d.market ?? null,
      resultText: d.resultText,
      rating: d.rating ?? null,
      isActive: d.isActive ?? true,
    };

    if (d.id) {
      const existing = await prisma.testimonial.findFirst({ where: { id: d.id, profileId: profile.id } });
      if (!existing) throw new ApiError(404, "Testimonial not found");
      await prisma.testimonial.update({ where: { id: existing.id }, data });
      return { id: existing.id };
    }
    const created = await prisma.testimonial.create({ data: { ...data, profileId: profile.id } });
    return { id: created.id };
  });
}

const DeleteSchema = z.object({ id: z.string() });

export async function DELETE(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = DeleteSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");
    const existing = await prisma.testimonial.findFirst({ where: { id: body.data.id, profileId: profile.id } });
    if (!existing) throw new ApiError(404, "Testimonial not found");
    await prisma.testimonial.delete({ where: { id: existing.id } });
    return { ok: true };
  });
}
