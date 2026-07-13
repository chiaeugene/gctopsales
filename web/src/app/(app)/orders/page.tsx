import Link from "next/link";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUSES } from "@/lib/constants";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AlertIcon } from "@/components/ui/icons";

export default async function OrdersPage(props: { searchParams: Promise<{ status?: string }> }) {
  const profile = await requireProfile();
  const { status } = await props.searchParams;

  const orders = await prisma.order.findMany({
    where: { profileId: profile.id, ...(status ? { status } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Orders & Conversations" />

      <div className="flex flex-wrap gap-2 animate-fade-up">
        <FilterChip href="/orders" label="All" active={!status} />
        {ORDER_STATUSES.map((s) => (
          <FilterChip key={s} href={`/orders?status=${encodeURIComponent(s)}`} label={s} active={status === s} />
        ))}
      </div>

      <Card padding="none" className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-black/45 border-b border-black/[0.06]">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.05]">
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-black/35">
                  No orders{status ? ` in "${status}"` : ""} yet.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-black/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/orders/${o.id}`} className="font-medium text-[var(--accent-ink)] hover:underline">
                    {o.customerName || o.externalContactId || "New customer"}
                  </Link>
                  {o.needsHuman && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600 font-semibold">
                      <AlertIcon className="w-3 h-3" /> needs you
                    </span>
                  )}
                  <div className="text-xs text-black/40 truncate max-w-[26rem]">{o.summary || o.productInterest || ""}</div>
                </td>
                <td className="px-4 py-3 text-xs text-black/60">{o.source}</td>
                <td className="px-4 py-3">
                  <Badge tone="accent">{o.status}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-black/60">{o.paymentStatus}</td>
                <td className="px-4 py-3 text-xs text-black/60 tabular-nums">{o.totalMyr ? `RM${o.totalMyr.toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3 text-xs text-black/40">{o.updatedAt.toLocaleString("en-MY")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-[var(--ink)] text-white px-3 py-1 text-xs font-medium"
          : "rounded-full border border-black/[0.08] px-3 py-1 text-xs font-medium text-black/60 hover:bg-black/[0.04] transition-colors"
      }
    >
      {label}
    </Link>
  );
}
