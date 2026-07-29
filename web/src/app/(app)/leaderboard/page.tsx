import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { MedalIcon, UsersIcon } from "@/components/ui/icons";

// ADMIN-ONLY master panel: every agent's pipeline broken down by conversation
// stage, so the boss sees at a glance who's converting and where each team
// member's chats are stuck. Agents don't get this page (or the nav link).

const STAGE_COLUMNS = [
  { key: "New Inquiry", label: "New" },
  { key: "Qualifying", label: "Qualifying" },
  { key: "Recommended", label: "Recommended" },
  { key: "Closing", label: "Closing" },
  { key: "Awaiting Payment", label: "Awaiting $" },
] as const;

export default async function LeaderboardPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me || me.role !== "ADMIN") redirect("/");

  const [profiles, stageGroups, needsHumanGroups] = await Promise.all([
    prisma.storeProfile.findMany({
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.order.groupBy({ by: ["profileId", "status"], _count: { _all: true } }),
    prisma.order.groupBy({ by: ["profileId"], where: { needsHuman: true }, _count: { _all: true } }),
  ]);

  const rows = await Promise.all(
    profiles.map(async (p) => {
      const stages: Record<string, number> = {};
      for (const g of stageGroups) if (g.profileId === p.id) stages[g.status] = g._count._all;
      const [total, paid, paidTotals] = await Promise.all([
        prisma.order.count({ where: { profileId: p.id } }),
        prisma.order.count({ where: { profileId: p.id, paymentStatus: "CONFIRMED" } }),
        prisma.order.aggregate({ where: { profileId: p.id, paymentStatus: "CONFIRMED" }, _sum: { totalMyr: true } }),
      ]);
      return {
        profileId: p.id,
        name: p.agentName || p.user.name,
        storeName: p.storeName,
        stages,
        lost: stages["Lost"] ?? 0,
        needsHuman: needsHumanGroups.find((g) => g.profileId === p.id)?._count._all ?? 0,
        total,
        paid,
        winRate: total > 0 ? Math.round((paid / total) * 100) : 0,
        revenue: paidTotals._sum.totalMyr ?? 0,
      };
    })
  );

  rows.sort((a, b) => b.revenue - a.revenue || b.winRate - a.winRate);
  const top = rows.slice(0, 3);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Team master panel"
        subtitle="Every agent's pipeline, stage by stage — who's converting, who's stuck, who needs help. Only you see this."
      />

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-black/45">No agent workspaces yet.</p>
        </Card>
      ) : (
        <>
          {/* Podium — top 3 by confirmed revenue */}
          <div className="grid sm:grid-cols-3 gap-4">
            {top.map((r, i) => (
              <Card key={r.profileId} interactive>
                <div className="flex items-start justify-between">
                  <MedalIcon rank={(i + 1) as 1 | 2 | 3} className="w-8 h-8" />
                </div>
                <div className="mt-3 font-semibold text-[15px] truncate">{r.name}</div>
                {r.storeName && <div className="text-xs text-black/40 truncate">{r.storeName}</div>}
                <div className="num mt-3 text-2xl font-semibold">RM{r.revenue.toLocaleString()}</div>
                <div className="mt-1.5 text-xs text-black/40">
                  {r.winRate}% win rate · {r.paid} converted
                </div>
              </Card>
            ))}
          </div>

          {/* Stage matrix — the actual master panel */}
          <Card padding="none" className="overflow-x-auto">
            <div className="px-5 py-4 border-b border-black/[0.06] flex items-center gap-2 font-semibold text-[15px]">
              <UsersIcon className="w-4 h-4 text-black/30" />
              Conversation stages per agent
            </div>
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-xs text-black/45 border-b border-black/[0.06]">
                  <th className="px-4 py-3">Agent</th>
                  {STAGE_COLUMNS.map((s) => (
                    <th key={s.key} className="px-3 py-3 text-center">{s.label}</th>
                  ))}
                  <th className="px-3 py-3 text-center text-emerald-700">Converted</th>
                  <th className="px-3 py-3 text-center text-red-600">Lost</th>
                  <th className="px-3 py-3 text-center text-amber-600">Needs help</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {rows.map((r) => (
                  <tr key={r.profileId} className="hover:bg-black/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-[12rem]">{r.name}</div>
                      <div className="text-[11px] text-black/40 truncate max-w-[12rem]">{r.storeName || "—"}</div>
                    </td>
                    {STAGE_COLUMNS.map((s) => (
                      <td key={s.key} className="px-3 py-3 text-center">
                        <StageCell value={r.stages[s.key] ?? 0} />
                      </td>
                    ))}
                    <td className="num px-3 py-3 text-center font-semibold text-emerald-700">{r.paid}</td>
                    <td className="num px-3 py-3 text-center text-red-600">{r.lost || ""}</td>
                    <td className="num px-3 py-3 text-center text-amber-600 font-semibold">{r.needsHuman || ""}</td>
                    <td className="num px-4 py-3 text-right font-semibold">RM{r.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <p className="text-xs text-black/35">
            Stage counts are live conversation stages from each agent&apos;s pipeline. &quot;Needs help&quot; = chats GC
            froze for a human. Drill into any agent&apos;s activity in{" "}
            <Link href="/admin" className="text-[var(--accent-ink)] underline underline-offset-2">Admin → Team activity</Link>.
          </p>
        </>
      )}
    </div>
  );
}

function StageCell({ value }: { value: number }) {
  if (!value) return <span className="text-black/15">·</span>;
  return (
    <span className="num inline-flex min-w-6 justify-center rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[12px] font-semibold text-[var(--accent-ink)]">
      {value}
    </span>
  );
}
