"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT, LanguageToggle } from "@/components/I18nProvider";
import {
  ChartIcon,
  BoxIcon,
  ChatIcon,
  MegaphoneIcon,
  FileIcon,
  StarIcon,
  StoreIcon,
  DumbbellIcon,
  UsersIcon,
  AdminIcon,
  ConnectIcon,
  SettingsIcon,
  TrophyIcon,
  GridIcon,
} from "@/components/ui/icons";

type NavItem = { href: string; labelKey: string; icon: (p: { className?: string }) => React.ReactElement };
type NavGroup = { labelKey: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    labelKey: "nav.group.sell",
    items: [
      { href: "/", labelKey: "nav.dashboard", icon: ChartIcon },
      { href: "/orders", labelKey: "nav.orders", icon: BoxIcon },
      { href: "/products", labelKey: "nav.products", icon: GridIcon },
      { href: "/playground", labelKey: "nav.workspace", icon: ChatIcon },
    ],
  },
  {
    labelKey: "nav.group.grow",
    items: [
      { href: "/campaigns", labelKey: "nav.campaigns", icon: MegaphoneIcon },
      { href: "/templates", labelKey: "nav.templates", icon: FileIcon },
      { href: "/testimonials", labelKey: "nav.results", icon: StarIcon },
    ],
  },
  {
    labelKey: "nav.group.train",
    items: [
      { href: "/setup", labelKey: "nav.setupGc", icon: StoreIcon },
      { href: "/train", labelKey: "nav.trainGc", icon: UsersIcon },
      { href: "/gym", labelKey: "nav.gym", icon: DumbbellIcon },
    ],
  },
  {
    labelKey: "nav.group.team",
    items: [{ href: "/leaderboard", labelKey: "nav.leaderboard", icon: TrophyIcon }],
  },
];

const setupItems: NavItem[] = [
  { href: "/connect", labelKey: "nav.connect", icon: ConnectIcon },
  { href: "/settings", labelKey: "nav.settings", icon: SettingsIcon },
];

export function Sidebar({
  email,
  isAdmin,
  onSignOut,
}: {
  email: string;
  isAdmin: boolean;
  onSignOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const initials = email.slice(0, 2).toUpperCase();

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // Team (leaderboard + admin) is the boss's master panel — agents don't see it.
  const allGroups: NavGroup[] = isAdmin
    ? [
        ...groups.slice(0, 3),
        { labelKey: "nav.group.team", items: [...groups[3].items, { href: "/admin", labelKey: "nav.admin", icon: AdminIcon }] },
      ]
    : groups.slice(0, 3);

  const navLink = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={[
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
          active
            ? "text-white bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-ink)_100%)] [box-shadow:var(--shadow-purple)]"
            : "text-black/65 hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)]",
        ].join(" ")}
      >
        <Icon className={`w-[17px] h-[17px] ${active ? "text-white" : "text-black/40"}`} />
        {t(item.labelKey)}
      </Link>
    );
  };

  const navContent = (
    <>
      <nav className="flex-1 px-3 space-y-5 overflow-y-auto pb-4">
        {allGroups.map((group) => (
          <div key={group.labelKey}>
            <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-black/30 mb-1.5">{t(group.labelKey)}</div>
            <div className="space-y-0.5">{group.items.map(navLink)}</div>
          </div>
        ))}
        <div>
          <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-black/30 mb-1.5">{t("nav.group.setup")}</div>
          <div className="space-y-0.5">{setupItems.map(navLink)}</div>
        </div>
      </nav>

      <div className="px-3 pb-2">
        <LanguageToggle />
      </div>
      <div className="p-3 border-t border-black/[0.06] flex items-center gap-2.5">
        <div className="w-8 h-8 shrink-0 rounded-full bg-[var(--accent-soft)] text-[var(--accent-ink)] flex items-center justify-center text-[11px] font-semibold">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate">{email}</div>
          <div className="text-[11px] text-black/40">{isAdmin ? t("nav.roleAdmin") : t("nav.roleAgent")}</div>
        </div>
        <form action={onSignOut}>
          <button className="text-[11px] font-medium text-black/35 hover:text-[var(--ink)] transition-colors" title="Sign out">
            {t("nav.signOut")}
          </button>
        </form>
      </div>
    </>
  );

  const brand = (
    <div className="px-5 pt-6 pb-5 flex items-center gap-2.5">
      <div
        className="w-8 h-8 rounded-xl shrink-0 [box-shadow:var(--shadow-purple)]"
        style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-ink) 100%)" }}
      />
      <div>
        <div className="text-[17px] font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          GC
          <span className="text-black/35 font-medium"> · AI Sales Team</span>
        </div>
        <div className="text-[11px] text-black/40 -mt-0.5">{t("nav.tagline")}</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — glass over the aurora canvas */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-black/[0.05] glass flex-col">
        {brand}
        {navContent}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 glass border-b border-black/[0.05] flex items-center gap-3 px-3">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 hover:bg-black/[0.04]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
        <div
          className="w-7 h-7 rounded-lg shrink-0"
          style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-ink) 100%)" }}
        />
        <div className="text-[15px] font-semibold tracking-tight">GC Top Sales</div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-white/90 backdrop-blur-2xl h-full shadow-xl flex flex-col animate-fade-up">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 hover:bg-black/[0.04] text-black/50">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
