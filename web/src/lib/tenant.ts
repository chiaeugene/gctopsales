import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { StoreProfile, User } from "@prisma/client";

// Resolves the authenticated tenant. Every API handler and server page goes
// through this — all queries must be scoped by the returned profile.id.
export async function requireProfile(): Promise<StoreProfile> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new UnauthorizedError();

  const profile = await prisma.storeProfile.findUnique({ where: { userId } });
  if (!profile) throw new UnauthorizedError();
  return profile;
}

/**
 * The owner account, named by the ADMIN_EMAIL environment variable, is ALWAYS an
 * admin regardless of the role stored on its row.
 *
 * This exists because the stored role is data, and data can be wrong: an account
 * created as an AGENT cannot see the Admin page, which means it cannot reach the
 * tool that would promote it. That is a locked door with the key on the inside.
 * Anchoring ownership to an environment variable makes it unlosable — it survives
 * a wrong role, a data reset, and a restore from backup, and changing who owns the
 * platform is one env var rather than a database edit.
 *
 * It only ever GRANTS admin. It never takes it away from anyone.
 */
// Angi owns this platform and runs everything from her account, so her address is
// named here rather than left to configuration. Hardcoding an identity is normally
// wrong, but the failure it prevents is worse: if her stored role is ever an AGENT
// she cannot see the Admin page, and the only tool that could promote her lives
// behind it. This is the one door that must never be lockable from the inside.
// ADMIN_EMAIL still grants rights as well, so ownership can move without a deploy.
const PLATFORM_OWNER = "angilim@gmail.com";

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const owners = new Set([PLATFORM_OWNER]);
  const configured = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (configured) owners.add(configured);
  return owners.has(email.trim().toLowerCase());
}

/** True for a stored ADMIN role or for the owner account. */
export function hasAdminRights(user: { role: string; email: string }): boolean {
  return user.role === "ADMIN" || isOwnerEmail(user.email);
}

// Resolves the authenticated platform ADMIN (super-admin panel routes only).
// Admins may or may not have their own StoreProfile — this checks rights, not
// tenancy.
export async function requireAdmin(): Promise<User> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new UnauthorizedError();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !hasAdminRights(user)) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
