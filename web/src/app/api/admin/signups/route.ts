import { z } from "zod";
import bcrypt from "bcryptjs";
import { handle, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { DEFAULT_DAILY_REPLY_CAP } from "@/lib/ai/engine";

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

    // Clone from the approving admin, same as the Sheet import does. Proof and
    // discovery menus come along because an agent whose GC has nothing to close
    // with on day one is a weak first impression, and these are text, so copying
    // them per agent costs almost nothing.
    const source = await prisma.storeProfile.findUnique({
      where: { userId: admin.id },
      include: {
        products: { orderBy: { sortOrder: "asc" } },
        // Photo BYTES are deliberately excluded. 55 results with images copied per
        // agent would grow the database by hundreds of megabytes for a team of
        // fifty. The words are what GC quotes; pictures come from the admin's
        // push-to-all-agents buttons.
        testimonials: { where: { isActive: true }, omit: { photoData: true } },
        discoveryMenus: { where: { isActive: true } },
        shareLinks: { where: { isActive: true } },
      },
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
            dailyReplyCap: DEFAULT_DAILY_REPLY_CAP,
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
      const reparent = <T extends { id: string; profileId: string; createdAt?: Date; updatedAt?: Date }>(rows: T[]) =>
        rows.map((r) => {
          const { id: _id, profileId: _p, createdAt: _c, updatedAt: _u, ...rest } = r;
          return { ...rest, profileId: user.profile!.id };
        });

      await prisma.product.createMany({ data: reparent(source.products) });
      if (source.testimonials.length) {
        // photoMimeType without the bytes would make the sender try to attach a
        // file that is not there, so it is cleared alongside them.
        await prisma.testimonial.createMany({
          data: reparent(source.testimonials).map((t) => ({ ...t, photoMimeType: null })),
        });
      }
      if (source.discoveryMenus.length) await prisma.discoveryMenu.createMany({ data: reparent(source.discoveryMenus) });
      if (source.shareLinks.length) await prisma.shareLink.createMany({ data: reparent(source.shareLinks) });
    }

    await prisma.agentSignup.update({ where: { id: signup.id }, data: { status: "APPROVED" } });
    return {
      ok: true,
      email: user.email,
      passcode,
      products: source?.products.length ?? 0,
      results: source?.testimonials.length ?? 0,
      menus: source?.discoveryMenus.length ?? 0,
    };
  });
}
