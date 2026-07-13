import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MedalIcon, UsersIcon } from "@/components/ui/icons";

// Team leaderboard: every agent workspace ranked by confirmed revenue, with
// win rate and active-pipeline size as supporting signals. No org/team
// boundary exists in the data model yet — every StoreProfile is "the team."
export default async function LeaderboardPage() {
  const session = await auth();
  const myUserId = (session?.user as { id?: string } | undefined)?.id;

  const profiles = await prisma.storeProfile.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const rows = await Promise.all(
    profiles.map(async (p) => {
      const [total, paid, openLeads, paidTotals] = await Promise.all([
        prisma.order.count({ where: { profileId: p.id } }),
        prisma.order.count({ where: { profileId: p.id, paymentStatus: "CONFIRMED" } }),
        prisma.order.count({
          where: {
            profileId: p.id,
            status: { notIn: ["Lost", "Payment Confirmed", "Processing", "Shipped", "Delivered"] },
          },
        }),
        prisma.order.aggregate({ where: { profileId: p.id, paymentStatus: "CONFIRMED" }, _sum: { totalMyr: true } }),
      ]);
      return {
        profileId: p.id,
        userId: p.user.id,
        name: p.agentName || p.user.name,
        storeName: p.storeName,
        revenue: paidTotals._sum.totalMyr ?? 0,
        winRate: total > 0 ? Math.round((paid / total) * 100) : 0,
        paid,
        openLeads,
      };
    })
  );

  rows.sort((a, b) => b.revenue - a.revenue || b.winRate - a.winRate);
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Team Leaderboard"
        subtitle="Every agent's confirmed sales, win rate, and active pipeline — ranked. One team, one board."
      />

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-black/45">No agent workspaces yet.</p>
        </Card>
      ) : (
        <>
          {/* Podium — top 3 get the hero treatment */}
          <div className="grid sm:grid-cols-3 gap-4">
            {top.map((r, i) => (
              <Card key={r.profileId} interactive className={r.userId === myUserId ? "ring-2 ring-[var(--accent)]" : ""}>
                <div className="flex items-start justify-between">
                  <MedalIcon rank={(i + 1) as 1 | 2 | 3} className="w-8 h-8" />
                  {r.userId === myUserId && <Badge tone="accent">You</Badge>}
                </div>
                <div className="mt-3 font-semibold text-[15px] truncate">{r.name}</div>
                {r.storeName && <div className="text-xs text-black/40 truncate">{r.storeName}</div>}
                <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">RM{r.revenue.toLocaleString()}</div>
                <div className="mt-1.5 text-xs text-black/40">
                  {r.winRate}% win rate · {r.paid} paid · {r.openLeads} in pipeline
                </div>
              </Card>
            ))}
          </div>

          {rest.length > 0 && (
            <Card padding="none">
              <div className="px-5 py-4 border-b border-black/[0.06] flex items-center gap-2 font-semibold text-[15px]">
                <UsersIcon className="w-4 h-4 text-black/30" />
                Rest of the team
              </div>
              <ul className="divide-y divide-black/[0.05]">
                {rest.map((r, i) => (
                  <li
                    key={r.profileId}
                    className={`flex items-center gap-4 px-5 py-3.5 ${r.userId === myUserId ? "bg-[var(--accent-soft)]/40" : ""}`}
                  >
                    <span className="w-6 text-center text-sm font-semibold text-black/30 tabular-nums">{i + 4}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate flex items-center gap-2">
                        {r.name}
                        {r.userId === myUserId && <Badge tone="accent">You</Badge>}
                      </div>
                      <div className="text-xs text-black/40 truncate">{r.winRate}% win rate · {r.openLeads} in pipeline</div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0">RM{r.revenue.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
