import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasAdminRights } from "@/lib/tenant";

/**
 * Server gate for boss-only pages. Hiding a link is not the same as closing the
 * door: anyone can type /campaigns into the address bar, so the pages themselves
 * must agree with the sidebar. Non-admins are sent to their dashboard, not an
 * error page — to an agent this page simply does not exist.
 */
export async function AdminOnly({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !hasAdminRights(user)) redirect("/");
  return <>{children}</>;
}
