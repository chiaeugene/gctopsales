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

// Resolves the authenticated platform ADMIN (super-admin panel routes only).
// Admins may or may not have their own StoreProfile — this checks the role,
// not tenancy.
export async function requireAdmin(): Promise<User> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new UnauthorizedError();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "ADMIN") throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
