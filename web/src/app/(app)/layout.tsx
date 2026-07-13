import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Authenticated app shell: left sidebar + content. Server component — the
// auth gate runs here for every app page.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  const nav = [
    { href: "/", label: "Dashboard" },
    { href: "/setup", label: "Set up GC" },
    { href: "/train", label: "Train GC" },
    { href: "/gym", label: "Sales Gym" },
    { href: "/orders", label: "Orders" },
    { href: "/campaigns", label: "Campaigns" },
    { href: "/templates", label: "Templates" },
    { href: "/products", label: "Products" },
    { href: "/testimonials", label: "Results" },
    { href: "/playground", label: "Test GC" },
    { href: "/connect", label: "Connect" },
    { href: "/settings", label: "Settings" },
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-neutral-200 bg-white flex flex-col">
        <div className="p-4 border-b border-neutral-200">
          <div className="text-lg font-bold text-violet-700">GC Top Sales</div>
          <div className="text-xs text-neutral-500 truncate">{user.email}</div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-violet-50 hover:text-violet-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
          className="p-3 border-t border-neutral-200"
        >
          <button className="w-full text-left rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  );
}
