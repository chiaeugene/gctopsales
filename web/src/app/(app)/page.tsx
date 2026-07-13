import Link from "next/link";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";
import { MARKET_INFO, type Market } from "@/lib/constants";
import { scoreLead } from "@/lib/orders/lead-score";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { HeroBanner } from "@/components/ui/HeroBanner";
import FeatureSection from "@/components/ui/stack-feature-section";
import { FlameIcon, SnowflakeIcon, AlertIcon, ChartIcon } from "@/components/ui/icons";

export default async function DashboardPage() {
  const profile = await requireProfile();

  const [total, needsHuman, awaitingPayment, paid, lost, recent, allForAnalytics] = await Promise.all([
    prisma.order.count({ where: { profileId: profile.id } }),
    prisma.order.count({ where: { profileId: profile.id, needsHuman: true } }),
    prisma.order.count({ where: { profileId: profile.id, status: "Awaiting Payment" } }),
    prisma.order.count({ where: { profileId: profile.id, paymentStatus: "CONFIRMED" } }),
    prisma.order.count({ where: { profileId: profile.id, status: "Lost" } }),
    prisma.order.findMany({ where: { profileId: profile.id }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.order.findMany({
      where: { profileId: profile.id },
      select: { status: true, paymentStatus: true, market: true, totalMyr: true, items: true, salesReport: true },
    }),
  ]);

  const paidTotals = await prisma.order.aggregate({
    where: { profileId: profile.id, paymentStatus: "CONFIRMED" },
    _sum: { totalMyr: true },
  });
  const revenue = paidTotals._sum.totalMyr ?? 0;

  // Priority queue: open leads ranked by buying temperature.
  const openLeads = await prisma.order.findMany({
    where: {
      profileId: profile.id,
      status: { notIn: ["Lost", "Payment Confirmed", "Processing", "Shipped", "Delivered"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  const hotLeads = openLeads
    .map((o) => ({ o, s: scoreLead(o) }))
    .filter((x) => x.s.score > 0 || x.o.needsHuman)
    .sort((a, b) => b.s.score - a.s.score)
    .slice(0, 6);

  // Conversion funnel — count orders that reached each stage or beyond.
  const stageOrder = ["New Inquiry", "Qualifying", "Recommended", "Closing", "Awaiting Payment", "Payment Confirmed"];
  const reached = (min: number) =>
    allForAnalytics.filter((o) => {
      const paidStage = o.paymentStatus === "CONFIRMED" ? 5 : -1;
      const s = Math.max(stageOrder.indexOf(o.status), paidStage);
      return s >= min;
    }).length;
  const funnel = [
    { label: "Inquiries", value: total },
    { label: "Qualified", value: reached(1) },
    { label: "Recommended", value: reached(2) },
    { label: "Closing", value: reached(3) },
    { label: "Paid", value: paid },
  ];
  const winRate = total > 0 ? Math.round((paid / total) * 100) : 0;

  // Top products by cart appearances.
  const productCount = new Map<string, number>();
  for (const o of allForAnalytics) {
    const items = parseJson<{ name: string; qty: number }[]>(o.items, []);
    for (const it of items) productCount.set(it.name, (productCount.get(it.name) ?? 0) + it.qty);
  }
  const topProducts = [...productCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Revenue by market.
  const revByMarket = new Map<string, number>();
  for (const o of allForAnalytics) {
    if (o.paymentStatus !== "CONFIRMED" || !o.totalMyr) continue;
    const m = (o.market as Market) || "MY";
    revByMarket.set(m, (revByMarket.get(m) ?? 0) + o.totalMyr);
  }

  // Aggregated lost-sale reasons from report cards.
  const lostReasons = new Map<string, number>();
  for (const o of allForAnalytics) {
    const r = parseJson<{ lostReason?: string | null; outcome?: string } | null>(o.salesReport, null);
    if (r?.lostReason) lostReasons.set(r.lostReason, (lostReasons.get(r.lostReason) ?? 0) + 1);
  }
  const topLostReasons = [...lostReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  const firstName = profile.agentName?.split(" ")[0] || "there";

  return (
    <div className="space-y-8">
      {/* Hero: real MAE product photography + brand purple, one dominant metric */}
      <HeroBanner
        image="/mae/hero-skincare.webp"
        eyebrow="GC Top Sales"
        title={`Welcome back, ${firstName}`}
        subtitle="Your AI sales team is working the pipeline right now."
        stats={[
          { label: "Confirmed revenue", value: `RM${revenue.toLocaleString()}` },
          { label: "Win rate", value: `${winRate}%` },
          { label: "Paid orders", value: paid },
        ]}
      />

      <FeatureSection />

      {needsHuman > 0 && (
        <Link
          href="/orders?status=Human+Takeover+Needed"
          className="flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 hover:bg-amber-100 transition-colors animate-fade-up"
        >
          <AlertIcon className="w-4 h-4 shrink-0" />
          {needsHuman} conversation{needsHuman > 1 ? "s" : ""} need your attention — click to review
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Conversations" value={total} />
        <StatCard label="Win rate" value={`${winRate}%`} />
        <StatCard label="Paid orders" value={paid} />
        <StatCard label="Awaiting payment" value={awaitingPayment} />
      </div>

      {/* Priority queue — work the hottest leads first */}
      <section>
        <Card padding="none">
          <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between">
            <span className="font-semibold text-[15px]">Priority queue — work these first</span>
            <span className="text-xs text-black/35">ranked by buying temperature</span>
          </div>
          <ul className="divide-y divide-black/[0.05]">
            {hotLeads.length === 0 && <li className="px-5 py-8 text-sm text-black/40">No open leads right now.</li>}
            {hotLeads.map(({ o, s }) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-black/[0.02] transition-colors">
                  <TempBadge temp={s.temp} score={s.score} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {o.customerName || o.externalContactId || "New customer"}
                      <span className="text-xs text-black/35"> · {o.status}</span>
                      {o.needsHuman && <span className="text-xs text-amber-600 font-semibold"> · needs you</span>}
                    </div>
                    <div className="text-xs text-black/40 truncate">{s.reasons.join(" · ")}</div>
                  </div>
                  {o.totalMyr && <span className="text-xs text-black/40 shrink-0">RM{o.totalMyr.toLocaleString()}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Funnel */}
        <Card>
          <div className="font-semibold text-[15px] mb-4 flex items-center gap-2">
            <ChartIcon className="w-4 h-4 text-black/30" />
            Conversion funnel
          </div>
          <div className="space-y-3">
            {funnel.map((f) => {
              const pct = funnel[0].value > 0 ? Math.round((f.value / funnel[0].value) * 100) : 0;
              return (
                <div key={f.label}>
                  <div className="flex justify-between text-xs text-black/45 mb-1">
                    <span>{f.label}</span>
                    <span>{f.value} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/[0.05] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Top products + revenue by market */}
        <Card>
          <div className="space-y-5">
            <div>
              <div className="font-semibold text-[15px] mb-2.5">Top products (by units in carts)</div>
              {topProducts.length === 0 ? (
                <p className="text-xs text-black/35">No carts yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {topProducts.map(([name, count]) => (
                    <li key={name} className="flex justify-between text-xs">
                      <span className="truncate mr-2 text-black/70">{name}</span>
                      <span className="text-black/40 shrink-0 tabular-nums">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="font-semibold text-[15px] mb-2.5">Revenue by market</div>
              {revByMarket.size === 0 ? (
                <p className="text-xs text-black/35">No paid orders yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {[...revByMarket.entries()].map(([m, amt]) => (
                    <li key={m} className="flex justify-between text-xs">
                      <span className="text-black/70">{MARKET_INFO[m as Market]?.name ?? m}</span>
                      <span className="text-black/40 tabular-nums">
                        {MARKET_INFO[m as Market]?.currencySymbol ?? "RM"}
                        {amt.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Lost-sale reasons */}
      {topLostReasons.length > 0 && (
        <Card>
          <div className="font-semibold text-[15px] mb-2.5">Why deals are lost (from report cards)</div>
          <ul className="space-y-1.5">
            {topLostReasons.map(([reason, count]) => (
              <li key={reason} className="flex justify-between text-xs">
                <span className="mr-2 text-black/70">{reason}</span>
                <span className="text-red-500 shrink-0 font-medium">{count}×</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card padding="none">
        <div className="px-5 py-4 border-b border-black/[0.06] font-semibold text-[15px]">Latest conversations</div>
        <ul className="divide-y divide-black/[0.05]">
          {recent.length === 0 && (
            <li className="px-5 py-8 text-sm text-black/40">
              No conversations yet — try the <Link href="/playground" className="text-[var(--accent-ink)] underline underline-offset-2">Playground</Link>.
            </li>
          )}
          {recent.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-black/[0.02] transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {o.customerName || o.externalContactId || "New customer"}{" "}
                    <span className="text-xs text-black/35">({o.source})</span>
                  </div>
                  <div className="text-xs text-black/40 truncate">{o.summary || o.productInterest || "—"}</div>
                </div>
                <Badge tone="accent">{o.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-xs text-black/30">Lost count: {lost} · Awaiting payment: {awaitingPayment}</p>
    </div>
  );
}

function TempBadge({ temp, score }: { temp: string; score: number }) {
  if (temp === "hot") return <Badge tone="hot" icon={<FlameIcon className="w-3.5 h-3.5" />}>{score}</Badge>;
  if (temp === "warm") return <Badge tone="warm">{score}</Badge>;
  return <Badge tone="cold" icon={<SnowflakeIcon className="w-3.5 h-3.5" />}>{score}</Badge>;
}
