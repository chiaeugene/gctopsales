"use client";

import { useEffect, useState } from "react";

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
      <div>
        <h1 className="text-2xl font-bold">Admin — Agent accounts</h1>
        <p className="text-sm text-neutral-500">
          Each agent gets their own workspace: own Meta channels, own customers, own payment details — pre-loaded with
          the full MAE catalog and GC Top Sales brains.
        </p>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}

      <PushCatalogCard />

      <form onSubmit={createTenant} className="rounded-xl bg-white border border-neutral-200 p-5 grid md:grid-cols-2 gap-3">
        <h2 className="font-semibold md:col-span-2">Create agent account</h2>
        <label className="block text-xs">
          <span className="text-neutral-500">Agent name</span>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="block text-xs">
          <span className="text-neutral-500">Store name (optional)</span>
          <input value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="block text-xs">
          <span className="text-neutral-500">Email</span>
          <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="block text-xs">
          <span className="text-neutral-500">Password (min 8 chars)</span>
          <input required type="text" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
        <div className="md:col-span-2">
          <button type="submit" disabled={busy} className="rounded-lg bg-violet-700 text-white px-4 py-2 text-xs font-semibold hover:bg-violet-800 disabled:opacity-50">
            {busy ? "Creating…" : "Create agent (with MAE catalog)"}
          </button>
        </div>
      </form>

      <div className="rounded-xl bg-white border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Products</th>
              <th className="px-4 py-3">Channels</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-neutral-500">{u.email}</div>
                </td>
                <td className="px-4 py-3 text-xs">{u.role}</td>
                <td className="px-4 py-3 text-xs">{u.profile?.storeName || "—"}</td>
                <td className="px-4 py-3 text-xs">{u.profile?._count.orders ?? 0}</td>
                <td className="px-4 py-3 text-xs">{u.profile?._count.products ?? 0}</td>
                <td className="px-4 py-3 text-xs">{u.profile?._count.channels ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    <div className="rounded-xl bg-white border border-neutral-200 p-5 space-y-3">
      <div>
        <h2 className="font-semibold">Push master catalog to all agents</h2>
        <p className="text-sm text-neutral-500">
          Edit your own catalog in <a href="/products" className="text-violet-700 underline">Products</a> and this
          month&apos;s promo in <a href="/settings" className="text-violet-700 underline">Settings</a>, then push to every
          agent. Matching is by product code, so each agent&apos;s own attachments, active toggles, and any products they
          added themselves are preserved — they can still self-manage afterward.
        </p>
      </div>
      {result && <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">✅ {result}</div>}
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
      <button
        onClick={push}
        disabled={busy || (!products && !promos)}
        className="rounded-lg bg-violet-700 text-white px-4 py-2 text-sm font-semibold hover:bg-violet-800 disabled:opacity-50"
      >
        {busy ? "Pushing…" : "Push to all agents"}
      </button>
    </div>
  );
}
