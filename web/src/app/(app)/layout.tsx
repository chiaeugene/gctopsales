import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";

// Products isn't in the sidebar nav directly (reached via Setup / Admin catalog flows)
// but stays routable.

// Authenticated app shell: left sidebar + content. Server component — the
// auth gate runs here for every app page.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar email={user.email} isAdmin={user.role === "ADMIN"} onSignOut={doSignOut} />
      {/* pt-18 clears the fixed mobile top bar; desktop keeps the old rhythm */}
      <main className="flex-1 min-w-0 px-4 pb-6 pt-[4.5rem] sm:px-6 lg:p-8 max-w-6xl">{children}</main>
    </div>
  );
}
