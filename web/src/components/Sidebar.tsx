"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

type NavItem = { href: string; label: string; icon: (p: { className?: string }) => React.ReactElement };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "Sell",
    items: [
      { href: "/", label: "Dashboard", icon: ChartIcon },
      { href: "/orders", label: "Orders", icon: BoxIcon },
      { href: "/products", label: "Products", icon: GridIcon },
      { href: "/playground", label: "Test GC", icon: ChatIcon },
    ],
  },
  {
    label: "Grow",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: MegaphoneIcon },
      { href: "/templates", label: "Templates", icon: FileIcon },
      { href: "/testimonials", label: "Results", icon: StarIcon },
    ],
  },
  {
    label: "Train",
    items: [
      { href: "/setup", label: "Set up GC", icon: StoreIcon },
      { href: "/train", label: "Train GC", icon: UsersIcon },
      { href: "/gym", label: "Sales Gym", icon: DumbbellIcon },
    ],
  },
  {
    label: "Team",
    items: [{ href: "/leaderboard", label: "Leaderboard", icon: TrophyIcon }],
  },
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
  const initials = email.slice(0, 2).toUpperCase();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const allGroups: NavGroup[] = isAdmin
    ? [...groups.slice(0, 3), { label: "Team", items: [...groups[3].items, { href: "/admin", label: "Admin", icon: AdminIcon }] }]
    : groups;

  return (
    <aside className="w-64 shrink-0 border-r border-black/[0.06] bg-white flex flex-col">
      <div className="px-5 pt-6 pb-5 flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-xl shrink-0 [box-shadow:var(--shadow-purple)]"
          style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-ink) 100%)" }}
        />
        <div>
          <div className="text-[17px] font-semibold tracking-tight">GC Top Sales</div>
          <div className="text-[11px] text-black/40 -mt-0.5">Sales team workspace</div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-5 overflow-y-auto">
        {allGroups.map((group) => (
          <div key={group.label}>
            <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-black/30 mb-1.5">{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
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
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-black/30 mb-1.5">Setup</div>
          <div className="space-y-0.5">
            <Link
              href="/connect"
              className={[
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                isActive("/connect")
                  ? "text-white bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-ink)_100%)] [box-shadow:var(--shadow-purple)]"
                  : "text-black/65 hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)]",
              ].join(" ")}
            >
              <ConnectIcon className={`w-[17px] h-[17px] ${isActive("/connect") ? "text-white" : "text-black/40"}`} />
              Connect
            </Link>
            <Link
              href="/settings"
              className={[
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                isActive("/settings")
                  ? "text-white bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-ink)_100%)] [box-shadow:var(--shadow-purple)]"
                  : "text-black/65 hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)]",
              ].join(" ")}
            >
              <SettingsIcon className={`w-[17px] h-[17px] ${isActive("/settings") ? "text-white" : "text-black/40"}`} />
              Settings
            </Link>
          </div>
        </div>
      </nav>

      <div className="p-3 border-t border-black/[0.06] flex items-center gap-2.5">
        <div className="w-8 h-8 shrink-0 rounded-full bg-[var(--accent-soft)] text-[var(--accent-ink)] flex items-center justify-center text-[11px] font-semibold">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate">{email}</div>
          <div className="text-[11px] text-black/40">{isAdmin ? "Admin" : "Agent"}</div>
        </div>
        <form action={onSignOut}>
          <button className="text-[11px] font-medium text-black/35 hover:text-[var(--ink)] transition-colors" title="Sign out">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
