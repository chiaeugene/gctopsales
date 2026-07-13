import Link from "next/link";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUSES } from "@/lib/constants";

export default async function OrdersPage(props: { searchParams: Promise<{ status?: string }> }) {
  const profile = await requireProfile();
  const { status } = await props.searchParams;

  const orders = await prisma.order.findMany({
    where: { profileId: profile.id, ...(status ? { status } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders & Conversations</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip href="/orders" label="All" active={!status} />
        {ORDER_STATUSES.map((s) => (
          <FilterChip key={s} href={`/orders?status=${encodeURIComponent(s)}`} label={s} active={status === s} />
        ))}
      </div>

      <div className="rounded-xl bg-white border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                  No orders{status ? ` in “${status}”` : ""} yet.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link href={`/orders/${o.id}`} className="font-medium text-violet-700 hover:underline">
                    {o.customerName || o.externalContactId || "New customer"}
                  </Link>
                  {o.needsHuman && <span className="ml-2 text-xs text-amber-600 font-semibold">⚠ needs you</span>}
                  <div className="text-xs text-neutral-400 truncate max-w-[26rem]">{o.summary || o.productInterest || ""}</div>
                </td>
                <td className="px-4 py-3 text-xs">{o.source}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-violet-50 text-violet-700 px-2 py-0.5 text-xs">{o.status}</span>
                </td>
                <td className="px-4 py-3 text-xs">{o.paymentStatus}</td>
                <td className="px-4 py-3 text-xs">{o.totalMyr ? `RM${o.totalMyr.toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3 text-xs text-neutral-500">{o.updatedAt.toLocaleString("en-MY")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-violet-700 text-white px-3 py-1 text-xs font-medium"
          : "rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
      }
    >
      {label}
    </Link>
  );
}
