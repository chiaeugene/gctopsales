import crypto from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { handle, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// TEMPORARY break-glass route: provisions a platform ADMIN account without an
// existing admin session (chicken-and-egg when nobody can log in yet).
//
// Fails closed: without ADMIN_BOOTSTRAP_SECRET set on the server it always
// returns 503, so it is inert unless deliberately armed. Delete this route and
// the env var once the master admin exists — normal admin creation happens on
// the Admin page.

const PostSchema = z.object({
  email: z.string().email(),
  passcode: z.string().min(6).max(100),
});

function secretOk(header: string | null): boolean {
  const secret = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!secret || !header) return false;
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  return handle(async () => {
    if (!process.env.ADMIN_BOOTSTRAP_SECRET) throw new ApiError(503, "Bootstrap disabled");
    if (!secretOk(req.headers.get("authorization"))) throw new ApiError(401, "Unauthorized");

    const body = PostSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");

    const email = body.data.email.toLowerCase();
    const passwordHash = await bcrypt.hash(body.data.passcode, 10);
    const existing = await prisma.user.findUnique({ where: { email } });

    const user = await prisma.user.upsert({
      where: { email },
      update: { role: "ADMIN", passwordHash },
      create: { email, name: "Master Admin", role: "ADMIN", passwordHash },
    });

    // Admins get their own workspace too (so they can use Workspace/Settings).
    // Seed its brains from an existing profile when one is available, matching
    // what tenant creation does for agents.
    let profile = await prisma.storeProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      const source = await prisma.storeProfile.findFirst({ orderBy: { createdAt: "asc" } });
      profile = await prisma.storeProfile.create({
        data: {
          userId: user.id,
          storeName: "MAE Master Store",
          agentName: "Master Admin",
          ...(source
            ? {
                identityBrain: source.identityBrain,
                salesBrain: source.salesBrain,
                fulfillmentBrain: source.fulfillmentBrain,
                catalogRules: source.catalogRules,
              }
            : {}),
        },
      });
    }

    // Prove the stored credential actually matches what was requested, so the
    // caller never has to test it by logging in.
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    const verified = !!fresh && (await bcrypt.compare(body.data.passcode, fresh.passwordHash));

    return {
      ok: true,
      email: user.email,
      role: user.role,
      action: existing ? "updated" : "created",
      profileId: profile.id,
      verified,
    };
  }, "admin/bootstrap");
}
