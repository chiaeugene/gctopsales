import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

// Real multi-user credentials auth (unlike Mandy's single-passcode phase):
// this platform hosts many agent accounts plus a super-admin, so every user
// has their own email/password row. Accounts are created by the super-admin
// (see /api/admin/tenants) or the seed script — there is deliberately no
// public self-signup.

// Brute-force throttle: passcodes are only 6 digits, so failed attempts per
// email are capped hard. In-memory is fine — the app runs as a single Render
// instance, and a restart resetting counters is acceptable.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const failedLogins = new Map<string, { count: number; lockedUntil: number }>();

function loginLocked(email: string): boolean {
  const entry = failedLogins.get(email);
  return !!entry && entry.count >= MAX_FAILED_ATTEMPTS && Date.now() < entry.lockedUntil;
}

function recordFailedLogin(email: string) {
  const entry = failedLogins.get(email) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_FAILED_ATTEMPTS) entry.lockedUntil = Date.now() + LOCKOUT_MS;
  failedLogins.set(email, entry);
  // Bound the map so it can't grow forever.
  if (failedLogins.size > 10_000) {
    const now = Date.now();
    for (const [k, v] of failedLogins) if (v.lockedUntil < now) failedLogins.delete(k);
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;
        if (loginLocked(email)) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          recordFailedLogin(email);
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          recordFailedLogin(email);
          logActivity({ actor: email, type: "login", summary: "Wrong passcode", ok: false });
          return null;
        }

        failedLogins.delete(email);
        const profile = await prisma.storeProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
        logActivity({ profileId: profile?.id, actor: email, type: "login", summary: "Signed in" });
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.userId && session.user) {
        (session.user as { id?: string }).id = token.userId as string;
      }
      return session;
    },
  },
});
