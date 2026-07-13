import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";
import { applyOrderEdit } from "@/lib/orders/confirm-payment";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/constants";
import { serializeInboundAttachment } from "@/lib/inbound-attachments";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await ctx.params;

    const order = await prisma.order.findFirst({
      where: { id, profileId: profile.id },
      include: { conversation: { include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } } },
    });
    if (!order) throw new ApiError(404, "Order not found");

    // Resolve inbound attachment metadata (never bytes) for the thread view.
    const inboundIds = (order.conversation?.messages ?? []).flatMap((m) =>
      parseJson<string[]>(m.inboundAttachmentIds, [])
    );
    const inbound = inboundIds.length
      ? await prisma.inboundAttachment.findMany({
          where: { id: { in: inboundIds }, profileId: profile.id },
          omit: { data: true },
        })
      : [];
    const inboundById = new Map(inbound.map((a) => [a.id, serializeInboundAttachment(a)]));

    return {
      order: {
        id: order.id,
        source: order.source,
        customerName: order.customerName,
        phone: order.phone,
        deliveryAddress: order.deliveryAddress,
        segment: order.segment,
        productInterest: order.productInterest,
        items: parseJson(order.items, []),
        totalMyr: order.totalMyr,
        status: order.status,
        paymentStatus: order.paymentStatus,
        trackingNumber: order.trackingNumber,
        summary: order.summary,
        nextAction: order.nextAction,
        needsHuman: order.needsHuman,
        takeoverReason: order.takeoverReason,
        salesReport: parseJson(order.salesReport, null),
        followUpCount: order.followUpCount,
        nextFollowUpAt: order.nextFollowUpAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      messages: (order.conversation?.messages ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        inboundAttachments: parseJson<string[]>(m.inboundAttachmentIds, [])
          .map((aid) => inboundById.get(aid))
          .filter(Boolean),
      })),
    };
  });
}

const PatchSchema = z.object({
  customerName: z.string().max(200).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  deliveryAddress: z.string().max(1000).nullable().optional(),
  segment: z.string().max(200).nullable().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  trackingNumber: z.string().max(200).nullable().optional(),
});

// The agent's manual edit endpoint. Money-state changes flow through
// applyOrderEdit — the single choke point — never a bare prisma.update.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await ctx.params;
    const body = PatchSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid order payload");

    const order = await prisma.order.findFirst({ where: { id, profileId: profile.id } });
    if (!order) throw new ApiError(404, "Order not found");

    const data: Record<string, unknown> = {};
    for (const key of ["customerName", "phone", "deliveryAddress", "segment", "status", "paymentStatus", "trackingNumber"] as const) {
      if (body.data[key] !== undefined) data[key] = body.data[key];
    }

    const updated = await applyOrderEdit(profile, order, data);
    return { ok: true, status: updated.status, paymentStatus: updated.paymentStatus };
  });
}
