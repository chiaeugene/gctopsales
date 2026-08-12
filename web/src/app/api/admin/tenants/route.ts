import { z } from "zod";
import bcrypt from "bcryptjs";
import { handle, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

// Super-admin tenant management. Creating a tenant = a User (AGENT role) + an
// empty StoreProfile, optionally cloning the admin's MAE catalog + brains so
// every new agent starts with the full GC Top Sales knowledge base.

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        profile: {
          select: {
            id: true,
            storeName: true,
            _count: { select: { orders: true, products: true, channels: true } },
          },
        },
      },
    });
    return { users };
  });
}

const PostSchema = z.object({
  email: z.string().email(),
  // 6-char minimum: agent passcodes default to the last 6 digits of their
  // phone number (the admin's chosen convention).
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(200),
  storeName: z.string().max(200).optional(),
  // ADMIN accounts see the Admin panel (all agents, passcode resets, errors).
  role: z.enum(["AGENT", "ADMIN"]).default("AGENT"),
  // Copy the admin profile's products + brains into the new tenant (default
  // true — that's the whole point of a MAE-agent platform).
  cloneCatalog: z.boolean().default(true),
});

const PatchSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(6).max(100),
});

// Admin-only passcode reset. The admin is the single authority for
// credentials — agents cannot change their own passcode.
export async function PATCH(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();

    // Two jobs on one endpoint: reset a passcode, or change a role.
    const roleChange = z.object({ userId: z.string(), role: z.enum(["AGENT", "ADMIN"]) }).safeParse(
      await req.clone().json()
    );
    if (roleChange.success) {
      const target = await prisma.user.findUnique({ where: { id: roleChange.data.userId } });
      if (!target) throw new ApiError(404, "User not found");
      // Never let the last admin demote themselves out of the building.
      if (roleChange.data.role === "AGENT") {
        const admins = await prisma.user.count({ where: { role: "ADMIN" } });
        if (admins <= 1) throw new ApiError(400, "That is the only admin left. Promote someone else first.");
        if (target.id === admin.id) throw new ApiError(400, "Ask another admin to change your own role.");
      }
      await prisma.user.update({ where: { id: target.id }, data: { role: roleChange.data.role } });
      return { ok: true, email: target.email, role: roleChange.data.role };
    }

    const body = PatchSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Passcode must be at least 6 characters");

    const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
    if (!user) throw new ApiError(404, "User not found");

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(body.data.password, 10) },
    });
    return { ok: true, email: user.email };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const body = PostSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid tenant payload");

    const email = body.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, "A user with this email already exists");

    const source = body.data.cloneCatalog
      ? await prisma.storeProfile.findUnique({
          where: { userId: admin.id },
          include: { products: { orderBy: { sortOrder: "asc" } } },
        })
      : null;

    const user = await prisma.user.create({
      data: {
        email,
        name: body.data.name,
        role: body.data.role,
        passwordHash: await bcrypt.hash(body.data.password, 10),
        profile: {
          create: {
            storeName: body.data.storeName ?? `${body.data.name}'s MAE Store`,
            agentName: body.data.name,
            ...(source
              ? {
                  identityBrain: source.identityBrain,
                  salesBrain: source.salesBrain,
                  fulfillmentBrain: source.fulfillmentBrain,
                  catalogRules: source.catalogRules,
                }
              : {}),
          },
        },
      },
      include: { profile: true },
    });

    if (source && user.profile) {
      // Product rows are copied per-tenant (each agent can toggle/annotate
      // their own catalog). Images aren't cloned — they'd multiply BLOBs;
      // agents upload their own or the admin pushes them later.
      for (const p of source.products) {
        await prisma.product.create({
          data: {
            profileId: user.profile.id,
            name: p.name,
            code: p.code,
            series: p.series,
            priceMemberMyr: p.priceMemberMyr,
            priceRetailMyr: p.priceRetailMyr,
            pointValue: p.pointValue,
            boxCount: p.boxCount,
            contents: p.contents,
            gifts: p.gifts,
            description: p.description,
            sellingPoints: p.sellingPoints,
            isActive: p.isActive,
            sortOrder: p.sortOrder,
          },
        });
      }
    }

    return { id: user.id, email: user.email, profileId: user.profile?.id };
  });
}
