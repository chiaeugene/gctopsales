import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";
import { GuidedTour } from "@/components/GuidedTour";
import { I18nProvider } from "@/components/I18nProvider";
import { LANG_COOKIE, normalizeLang } from "@/lib/i18n";

// Products isn't in the sidebar nav directly (reached via Setup / Admin catalog flows)
// but stays routable.

// Authenticated app shell: left sidebar + content. Server component — the
// auth gate runs here for every app page.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: { select: { agentName: true } } },
  });
  if (!user) redirect("/login");

  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <I18nProvider lang={lang}>
      <div className="min-h-screen flex">
        <Sidebar email={user.email} isAdmin={user.role === "ADMIN"} onSignOut={doSignOut} />
        {/* pt-18 clears the fixed mobile top bar. The inner div centers the
            content column in the remaining width — without it every page hugs
            the sidebar and wide screens get a dead right gutter. */}
        <main className="flex-1 min-w-0 px-4 pb-6 pt-[4.5rem] sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
        {/* Mounted in the layout so the panel survives the navigations it
            triggers: the page behind it changes, the tour does not restart. */}
        <GuidedTour agentName={(user.profile?.agentName ?? user.name ?? "").split(" ")[0]} />
      </div>
    </I18nProvider>
  );
}
