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

// Team convention: an agent's passcode is the last 6 digits of their phone.
function passcodeFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 6 ? digits.slice(-6) : "";
}

export default function AdminPage() {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", storeName: "", phone: "" });
  const [makeAdmin, setMakeAdmin] = useState(false);
  // Once the admin types their own passcode, stop auto-filling from the phone.
  const [passcodeEdited, setPasscodeEdited] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/tenants");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to load (admin only)");
      return;
    }
    setUsers(json.users);
  }

  async function resetPasscode(u: TenantUser) {
    const passcode = prompt(
      `New passcode for ${u.name} (${u.email}) — usually the last 6 digits of their phone:`
    );
    if (!passcode) return;
    if (passcode.trim().length < 6) {
      alert("Passcode must be at least 6 characters.");
      return;
    }
    const res = await fetch("/api/admin/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, password: passcode.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || "Reset failed");
      return;
    }
    alert(`Passcode updated for ${u.email}. Tell them the new passcode — it takes effect immediately.`);
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
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.name,
          storeName: form.storeName || undefined,
          role: makeAdmin ? "ADMIN" : "AGENT",
          cloneCatalog: true,
        }),
      });
      if (!res.ok) {
        setError((await res.json()).error || "Failed to create tenant");
        return;
      }
      setForm({ email: "", password: "", name: "", storeName: "", phone: "" });
      setMakeAdmin(false);
      setPasscodeEdited(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Admin — Agent accounts"
        subtitle="Each agent gets their own workspace: own Meta channels, own customers, own payment details — pre-loaded with the full MAE catalog and GC Top Sales brains."
      />
      {error && <div className="text-sm text-red-600">{error}</div>}

      <PushCatalogCard />

      <SheetImportCard onRegistered={load} />

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
            <span className="text-black/45">Phone (passcode auto-fills from last 6 digits)</span>
            <input
              value={form.phone}
              placeholder="e.g. 012-3456789"
              onChange={(e) => {
                const phone = e.target.value;
                setForm((f) => ({ ...f, phone, password: passcodeEdited ? f.password : passcodeFromPhone(phone) }));
              }}
              className={inputClass}
            />
          </label>
          <label className="block text-xs">
            <span className="text-black/45">Passcode (6 digits — what the agent logs in with)</span>
            <input
              required
              type="text"
              minLength={6}
              value={form.password}
              onChange={(e) => {
                setPasscodeEdited(true);
                setForm({ ...form, password: e.target.value });
              }}
              className={inputClass}
            />
          </label>
          <label className="md:col-span-2 flex items-start gap-2 text-xs rounded-xl border border-black/[0.07] bg-black/[0.015] px-3 py-2.5">
            <input
              type="checkbox"
              checked={makeAdmin}
              onChange={(e) => setMakeAdmin(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-black/75">Make this a platform admin</span>
              <span className="block text-black/45">
                Admins see every agent, can reset passcodes, push the catalog and view errors. Only tick this for
                yourself or a co-owner.
              </span>
            </span>
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : makeAdmin ? "Create admin (with MAE catalog)" : "Create agent (with MAE catalog)"}
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
              <th className="px-4 py-3"></th>
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
                <td className="px-4 py-3">
                  <button
                    onClick={() => resetPasscode(u)}
                    className="text-[11px] font-medium text-[var(--accent-ink)] hover:underline whitespace-nowrap"
                  >
                    Reset passcode
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <RecentErrorsCard />
    </div>
  );
}

type SheetAgent = {
  name: string;
  email: string;
  phone: string;
  passcode: string | null;
  exists: boolean;
};
type RowStatus = "ready" | "registering" | "done" | "failed";

// Google Sheet as the agent roster: paste a link-shared sheet with
// Name / Email / Phone columns, load it, review the prefilled rows, then
// register everyone new in one click. Passcode = last 6 digits of phone.
function SheetImportCard({ onRegistered }: { onRegistered: () => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [rows, setRows] = useState<SheetAgent[]>([]);
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  // Remember the sheet link on this device so it's truly one-click next time.
  useEffect(() => {
    const saved = localStorage.getItem("gc-admin-sheet-url");
    if (saved) setUrl(saved);
  }, []);

  async function loadSheet() {
    setBusy(true);
    setError(null);
    setSummary(null);
    setRows([]);
    setStatus({});
    setRowError({});
    try {
      const res = await fetch("/api/admin/import-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl: url }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not load the sheet");
        return;
      }
      localStorage.setItem("gc-admin-sheet-url", url);
      setRows(json.agents);
    } finally {
      setBusy(false);
    }
  }

  async function registerAllNew() {
    setBusy(true);
    setError(null);
    setSummary(null);
    let ok = 0;
    let failed = 0;
    try {
      for (const a of rows) {
        if (a.exists || !a.passcode) continue;
        setStatus((s) => ({ ...s, [a.email]: "registering" }));
        try {
          const res = await fetch("/api/admin/tenants", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: a.email, password: a.passcode, name: a.name, cloneCatalog: true }),
          });
          if (res.ok) {
            ok++;
            setStatus((s) => ({ ...s, [a.email]: "done" }));
          } else {
            failed++;
            const json = await res.json().catch(() => ({}));
            setStatus((s) => ({ ...s, [a.email]: "failed" }));
            setRowError((s) => ({ ...s, [a.email]: json.error || "Failed" }));
          }
        } catch {
          failed++;
          setStatus((s) => ({ ...s, [a.email]: "failed" }));
        }
      }
      setSummary(`Registered ${ok} agent${ok === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}.`);
      await onRegistered();
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = rows.filter((a) => !a.exists && a.passcode && status[a.email] !== "done").length;

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">Register agents from Google Sheet</h2>
        <p className="text-sm text-black/45">
          Keep your agent roster in a Google Sheet with <strong>Name</strong>, <strong>Email</strong> and{" "}
          <strong>Phone</strong> columns. Share it as &quot;Anyone with the link: Viewer&quot;, paste the link, and load.
          Each agent&apos;s passcode is set to the <strong>last 6 digits of their phone number</strong>, and they get the
          full MAE catalog + GC brains.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/…"
          className={inputClass + " !mt-0 flex-1"}
        />
        <Button onClick={loadSheet} disabled={busy || !url.trim()}>
          {busy && rows.length === 0 ? "Loading…" : "Load agents"}
        </Button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {summary && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CheckIcon className="w-4 h-4 shrink-0" />
          {summary}
        </div>
      )}
      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-black/45 border-b border-black/[0.06]">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Passcode</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {rows.map((a) => (
                  <tr key={a.email}>
                    <td className="py-2 pr-3">{a.name}</td>
                    <td className="py-2 pr-3 text-xs">{a.email}</td>
                    <td className="py-2 pr-3 text-xs tabular-nums">{a.phone || "—"}</td>
                    <td className="py-2 pr-3 text-xs tabular-nums font-medium">{a.passcode || "no phone!"}</td>
                    <td className="py-2 text-xs">
                      {a.exists ? (
                        <span className="text-black/40">already registered</span>
                      ) : !a.passcode ? (
                        <span className="text-red-600">needs a phone number in the sheet</span>
                      ) : status[a.email] === "done" ? (
                        <span className="text-emerald-700 inline-flex items-center gap-1">
                          <CheckIcon className="w-3.5 h-3.5" /> registered
                        </span>
                      ) : status[a.email] === "failed" ? (
                        <span className="text-red-600">{rowError[a.email] || "failed"}</span>
                      ) : status[a.email] === "registering" ? (
                        <span className="text-black/45">registering…</span>
                      ) : (
                        <span className="text-[var(--accent-ink)]">ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={registerAllNew} disabled={busy || pendingCount === 0}>
            {busy ? "Registering…" : `Register ${pendingCount} new agent${pendingCount === 1 ? "" : "s"}`}
          </Button>
        </>
      )}
    </Card>
  );
}

type ErrorRow = { id: string; route: string; message: string; createdAt: string };

// Production failures land in ErrorLog (see lib/api.ts). This card is the
// admin's window into them — if it's empty, the platform is healthy.
function RecentErrorsCard() {
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/errors");
      if (res.ok) setErrors((await res.json()).errors ?? []);
      setLoaded(true);
    })();
  }, []);

  return (
    <Card padding="none">
      <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between">
        <span className="font-semibold">Recent errors (last 7 days)</span>
        {loaded && errors.length === 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckIcon className="w-3.5 h-3.5" /> all healthy
          </span>
        )}
      </div>
      {errors.length > 0 && (
        <ul className="divide-y divide-black/[0.05] max-h-72 overflow-y-auto">
          {errors.map((e) => (
            <li key={e.id} className="px-5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium">{e.route}</span>
                <span className="text-[11px] text-black/35 shrink-0">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-xs text-red-700/80 break-all">{e.message}</div>
            </li>
          ))}
        </ul>
      )}
      {loaded && errors.length === 0 && (
        <p className="px-5 py-4 text-xs text-black/40">No server errors recorded. This fills up automatically if anything breaks in production.</p>
      )}
    </Card>
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
