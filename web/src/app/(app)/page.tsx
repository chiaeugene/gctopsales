import Link from "next/link";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";
import { MARKET_INFO, type Market } from "@/lib/constants";
import { scoreLead } from "@/lib/orders/lead-score";

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

  const stats = [
    { label: "Conversations", value: total },
    { label: "Win rate", value: `${winRate}%` },
    { label: "Paid orders", value: paid },
    { label: "Revenue", value: `RM${(paidTotals._sum.totalMyr ?? 0).toLocaleString()}` },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {needsHuman > 0 && (
        <Link href="/orders?status=Human+Takeover+Needed" className="block rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 hover:bg-amber-100">
          ⚠️ {needsHuman} conversation{needsHuman > 1 ? "s" : ""} need your attention — click to review
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white border border-neutral-200 p-4">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-sm text-neutral-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Priority queue — work the hottest leads first */}
      <section className="rounded-xl bg-white border border-neutral-200">
        <div className="px-4 py-3 border-b border-neutral-200 font-semibold text-sm flex items-center justify-between">
          <span>🔥 Priority queue — work these first</span>
          <span className="text-xs font-normal text-neutral-400">ranked by buying temperature</span>
        </div>
        <ul className="divide-y divide-neutral-100">
          {hotLeads.length === 0 && <li className="px-4 py-6 text-sm text-neutral-500">No open leads right now.</li>}
          {hotLeads.map(({ o, s }) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                <TempBadge temp={s.temp} score={s.score} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {o.customerName || o.externalContactId || "New customer"}
                    <span className="text-xs text-neutral-400"> · {o.status}</span>
                    {o.needsHuman && <span className="text-xs text-amber-600 font-semibold"> · needs you</span>}
                  </div>
                  <div className="text-xs text-neutral-500 truncate">{s.reasons.join(" · ")}</div>
                </div>
                {o.totalMyr && <span className="text-xs text-neutral-500 shrink-0">RM{o.totalMyr.toLocaleString()}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Funnel */}
        <section className="rounded-xl bg-white border border-neutral-200 p-4">
          <div className="font-semibold text-sm mb-3">Conversion funnel</div>
          <div className="space-y-2">
            {funnel.map((f) => {
              const pct = funnel[0].value > 0 ? Math.round((f.value / funnel[0].value) * 100) : 0;
              return (
                <div key={f.label}>
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>{f.label}</span>
                    <span>{f.value} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div className="h-full bg-violet-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Top products + revenue by market */}
        <section className="rounded-xl bg-white border border-neutral-200 p-4 space-y-4">
          <div>
            <div className="font-semibold text-sm mb-2">Top products (by units in carts)</div>
            {topProducts.length === 0 ? (
              <p className="text-xs text-neutral-400">No carts yet.</p>
            ) : (
              <ul className="space-y-1">
                {topProducts.map(([name, count]) => (
                  <li key={name} className="flex justify-between text-xs">
                    <span className="truncate mr-2">{name}</span>
                    <span className="text-neutral-500 shrink-0">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="font-semibold text-sm mb-2">Revenue by market</div>
            {revByMarket.size === 0 ? (
              <p className="text-xs text-neutral-400">No paid orders yet.</p>
            ) : (
              <ul className="space-y-1">
                {[...revByMarket.entries()].map(([m, amt]) => (
                  <li key={m} className="flex justify-between text-xs">
                    <span>{MARKET_INFO[m as Market]?.name ?? m}</span>
                    <span className="text-neutral-500">
                      {MARKET_INFO[m as Market]?.currencySymbol ?? "RM"}
                      {amt.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Lost-sale reasons */}
      {topLostReasons.length > 0 && (
        <section className="rounded-xl bg-white border border-neutral-200 p-4">
          <div className="font-semibold text-sm mb-2">Why deals are lost (from report cards)</div>
          <ul className="space-y-1">
            {topLostReasons.map(([reason, count]) => (
              <li key={reason} className="flex justify-between text-xs">
                <span className="mr-2">{reason}</span>
                <span className="text-red-500 shrink-0">{count}×</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl bg-white border border-neutral-200">
        <div className="px-4 py-3 border-b border-neutral-200 font-semibold text-sm">Latest conversations</div>
        <ul className="divide-y divide-neutral-100">
          {recent.length === 0 && (
            <li className="px-4 py-6 text-sm text-neutral-500">
              No conversations yet — try the <Link href="/playground" className="text-violet-700 underline">Playground</Link>.
            </li>
          )}
          {recent.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {o.customerName || o.externalContactId || "New customer"}{" "}
                    <span className="text-xs text-neutral-400">({o.source})</span>
                  </div>
                  <div className="text-xs text-neutral-500 truncate">{o.summary || o.productInterest || "—"}</div>
                </div>
                <span className="ml-3 shrink-0 rounded-full bg-violet-50 text-violet-700 px-2.5 py-1 text-xs font-medium">{o.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-neutral-400">Lost count: {lost} · Awaiting payment: {awaitingPayment}</p>
    </div>
  );
}

function TempBadge({ temp, score }: { temp: string; score: number }) {
  const style =
    temp === "hot" ? "bg-red-100 text-red-700" : temp === "warm" ? "bg-amber-100 text-amber-700" : "bg-neutral-100 text-neutral-500";
  const emoji = temp === "hot" ? "🔥" : temp === "warm" ? "🌤️" : "❄️";
  return (
    <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${style}`} title={`Score ${score}/100`}>
      {emoji} {score}
    </span>
  );
}
