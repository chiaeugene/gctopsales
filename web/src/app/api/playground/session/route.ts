import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";

// Playground v2: multiple named chats, one per real customer the agent is
// juggling. Each chat is still an Order+Conversation with source PLAYGROUND —
// the exact production pipeline.

const CreateSchema = z.object({ name: z.string().max(80).optional() });

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    let name: string | undefined;
    try {
      const body = CreateSchema.safeParse(await req.json());
      if (body.success) name = body.data.name?.trim() || undefined;
    } catch {
      // empty body is fine
    }
    const order = await prisma.order.create({
      data: {
        profileId: profile.id,
        source: "PLAYGROUND",
        customerName: name,
        conversation: { create: { profileId: profile.id, kind: "PLAYGROUND" } },
      },
      include: { conversation: true },
    });
    return { orderId: order.id, conversationId: order.conversation!.id };
  });
}

// List all playground chats — or, with ?orderId=, one chat's full history.
export async function GET(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");

    if (orderId) {
      const order = await prisma.order.findFirst({
        where: { id: orderId, profileId: profile.id, source: "PLAYGROUND" },
        include: {
          conversation: {
            include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
          },
        },
      });
      if (!order || !order.conversation) throw new ApiError(404, "Chat not found");
      return {
        order: {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
          needsHuman: order.needsHuman,
          items: parseJson(order.items, []),
          totalMyr: order.totalMyr,
          customerName: order.customerName,
          segment: order.segment,
        },
        messages: order.conversation.messages.map((m) => ({
          role: m.role,
          content: m.content,
          attachmentIds: parseJson<string[]>(m.attachmentIds ?? "[]", []),
        })),
      };
    }

    const orders = await prisma.order.findMany({
      where: { profileId: profile.id, source: "PLAYGROUND" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        conversation: {
          include: {
            messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
          },
        },
      },
    });
    return {
      chats: orders.map((o) => ({
        orderId: o.id,
        name: o.customerName,
        status: o.status,
        needsHuman: o.needsHuman,
        updatedAt: o.updatedAt,
        lastMessage: o.conversation?.messages[0]?.content?.slice(0, 80) ?? null,
      })),
    };
  });
}

const PatchSchema = z.object({ orderId: z.string(), name: z.string().min(1).max(80) });

// Rename a chat (stored as the order's customerName so the CRM shows it too).
export async function PATCH(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = PatchSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");
    const order = await prisma.order.findFirst({
      where: { id: body.data.orderId, profileId: profile.id, source: "PLAYGROUND" },
    });
    if (!order) throw new ApiError(404, "Chat not found");
    await prisma.order.update({ where: { id: order.id }, data: { customerName: body.data.name.trim() } });
    return { ok: true };
  });
}

const DeleteSchema = z.object({ orderId: z.string() });

export async function DELETE(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = DeleteSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");
    const order = await prisma.order.findFirst({
      where: { id: body.data.orderId, profileId: profile.id, source: "PLAYGROUND" },
    });
    if (!order) throw new ApiError(404, "Chat not found");
    await prisma.order.delete({ where: { id: order.id } });
    return { ok: true };
  });
}
