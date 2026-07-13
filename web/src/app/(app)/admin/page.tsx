"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";

type TenantUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  profile: {
    id: string;
    storeName: string | null;
    _count: { orders: number; products: number; channels: number };
  } | null;
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow";

export default function AdminPage() {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", storeName: "" });

  async function load() {
    const res = await fetch("/api/admin/tenants");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to load (admin only)");
      return;
    }
    setUsers(json.users);
  }
  useEffect(() => {
    load();
  }, []);

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, storeName: form.storeName || undefined, cloneCatalog: true }),
      });
      if (!res.ok) {
        setError((await res.json()).error || "Failed to create tenant");
        return;
      }
      setForm({ email: "", password: "", name: "", storeName: "" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Admin — Agent accounts"
        subtitle="Each agent gets their own workspace: own Meta channels, own customers, own payment details — pre-loaded with the full MAE catalog and GC Top Sales brains."
      />
      {error && <div className="text-sm text-red-600">{error}</div>}

      <PushCatalogCard />

      <Card padding="none">
        <form onSubmit={createTenant} className="grid md:grid-cols-2 gap-3 p-5">
          <h2 className="font-semibold md:col-span-2">Create agent account</h2>
          <label className="block text-xs">
            <span className="text-black/45">Agent name</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </label>
          <label className="block text-xs">
            <span className="text-black/45">Store name (optional)</span>
            <input value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} className={inputClass} />
          </label>
          <label className="block text-xs">
            <span className="text-black/45">Email</span>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
          </label>
          <label className="block text-xs">
            <span className="text-black/45">Password (min 8 chars)</span>
            <input required type="text" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} />
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create agent (with MAE catalog)"}
            </Button>
          </div>
        </form>
      </Card>

      <Card padding="none" className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-black/45 border-b border-black/[0.06]">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Products</th>
              <th className="px-4 py-3">Channels</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.05]">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-black/45">{u.email}</div>
                </td>
                <td className="px-4 py-3 text-xs">{u.role}</td>
                <td className="px-4 py-3 text-xs">{u.profile?.storeName || "—"}</td>
                <td className="px-4 py-3 text-xs tabular-nums">{u.profile?._count.orders ?? 0}</td>
                <td className="px-4 py-3 text-xs tabular-nums">{u.profile?._count.products ?? 0}</td>
                <td className="px-4 py-3 text-xs tabular-nums">{u.profile?._count.channels ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function PushCatalogCard() {
  const [products, setProducts] = useState(true);
  const [promos, setPromos] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function push() {
    if (!products && !promos) return;
    if (!confirm("Push your master catalog to ALL agents? This updates their product prices/details and (optionally) this month's promotions.")) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/push-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products, currentPromotions: promos }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Push failed");
        return;
      }
      setResult(`Pushed to ${json.agentsUpdated}/${json.agentCount} agents · ${json.productsSynced} product syncs.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">Push master catalog to all agents</h2>
        <p className="text-sm text-black/45">
          Edit your own catalog in <a href="/products" className="text-[var(--accent-ink)] underline">Products</a> and this
          month&apos;s promo in <a href="/settings" className="text-[var(--accent-ink)] underline">Settings</a>, then push to every
          agent. Matching is by product code, so each agent&apos;s own attachments, active toggles, and any products they
          added themselves are preserved — they can still self-manage afterward.
        </p>
      </div>
      {result && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CheckIcon className="w-4 h-4 shrink-0" />
          {result}
        </div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={products} onChange={(e) => setProducts(e.target.checked)} />
          Product prices &amp; details
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={promos} onChange={(e) => setPromos(e.target.checked)} />
          This month&apos;s promotions
        </label>
      </div>
      <Button onClick={push} disabled={busy || (!products && !promos)}>
        {busy ? "Pushing…" : "Push to all agents"}
      </Button>
    </Card>
  );
}
