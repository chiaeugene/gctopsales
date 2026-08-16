import { z } from "zod";
import bcrypt from "bcryptjs";
import { handle, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

/**
 * The admin side of /join: review requests, and turn one into a real account.
 *
 * Approving does exactly what the Google Sheet import does, so there is one way
 * an agent account comes into existence rather than two that can drift apart:
 * the passcode is the last 6 digits of their phone, and the catalogue and brains
 * are cloned from the approving admin's own profile.
 */

/** The house convention: last 6 digits of the phone number. */
function passcodeFromPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 6 ? digits.slice(-6) : null;
}

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const signups = await prisma.agentSignup.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    // Flag the ones that would collide before the admin clicks, and whether the
    // named leader is somebody we actually know.
    const emails = signups.map((s) => s.email);
    const taken = new Set(
      (await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } })).map((u) => u.email)
    );
    const leaders = new Set(
      (await prisma.storeProfile.findMany({ select: { agentName: true } }))
        .map((p) => (p.agentName ?? "").trim().toLowerCase())
        .filter(Boolean)
    );
    return {
      signups: signups.map((s) => ({
        ...s,
        alreadyHasAccount: taken.has(s.email),
        passcode: passcodeFromPhone(s.phone),
        leaderKnown: s.leaderName ? leaders.has(s.leaderName.trim().toLowerCase()) : null,
      })),
    };
  });
}

const PostSchema = z.object({
  id: z.string(),
  action: z.enum(["approve", "dismiss"]),
});

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const body = PostSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid request");

    const signup = await prisma.agentSignup.findUnique({ where: { id: body.data.id } });
    if (!signup) throw new ApiError(404, "Sign-up not found");

    if (body.data.action === "dismiss") {
      await prisma.agentSignup.update({ where: { id: signup.id }, data: { status: "DISMISSED" } });
      return { ok: true, dismissed: signup.email };
    }

    const passcode = passcodeFromPhone(signup.phone);
    if (!passcode) throw new ApiError(400, "That phone number has too few digits to make a passcode");

    const existing = await prisma.user.findUnique({ where: { email: signup.email } });
    if (existing) {
      await prisma.agentSignup.update({ where: { id: signup.id }, data: { status: "APPROVED" } });
      throw new ApiError(409, "That email already has an account. Marked as handled.");
    }

    // Clone from the approving admin, same as the Sheet import does.
    const source = await prisma.storeProfile.findUnique({
      where: { userId: admin.id },
      include: { products: { orderBy: { sortOrder: "asc" } } },
    });

    const user = await prisma.user.create({
      data: {
        email: signup.email,
        name: signup.name,
        passwordHash: await bcrypt.hash(passcode, 10),
        role: "AGENT",
        profile: {
          create: {
            agentName: signup.name,
            leaderName: signup.leaderName,
            storeName: source?.storeName,
            city: source?.city,
            state: source?.state,
            homeMarket: source?.homeMarket ?? "MY",
            marketsServed: source?.marketsServed ?? '["MY"]',
            identityBrain: source?.identityBrain ?? "{}",
            salesBrain: source?.salesBrain ?? "{}",
            // Payment details are NOT cloned: they are personal, and inheriting
            // somebody else's bank account is the worst possible default.
            fulfillmentBrain: "{}",
            catalogRules: source?.catalogRules ?? "{}",
          },
        },
      },
      include: { profile: true },
    });

    if (source && user.profile) {
      await prisma.product.createMany({
        data: source.products.map((p) => {
          const { id: _id, profileId: _profileId, createdAt: _c, updatedAt: _u, ...rest } = p;
          return { ...rest, profileId: user.profile!.id };
        }),
      });
    }

    await prisma.agentSignup.update({ where: { id: signup.id }, data: { status: "APPROVED" } });
    return { ok: true, email: user.email, passcode, products: source?.products.length ?? 0 };
  });
}
