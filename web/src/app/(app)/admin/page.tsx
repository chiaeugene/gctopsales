"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import { welcomeMessage, waNumber } from "@/lib/welcome-message";

type TenantUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  isOwner?: boolean;
  createdAt: string;
  profile: {
    id: string;
    storeName: string | null;
    leaderName?: string | null;
    dailyReplyCap?: number | null;
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

  // The cost control. Empty clears it back to the platform default rather than
  // setting zero, because zero means "no replies at all" and is a real choice.
  async function setAllCaps() {
    const input = prompt(
      "Daily reply limit for EVERY agent. This overwrites each agent's own limit. Leave empty to put everyone back on the platform default.",
      "100"
    );
    if (input === null) return;
    const trimmed = input.trim();
    const dailyReplyCap = trimmed === "" ? null : Number(trimmed);
    if (dailyReplyCap !== null && (!Number.isInteger(dailyReplyCap) || dailyReplyCap < 0)) {
      setError("Enter a whole number, or leave it empty for the default");
      return;
    }
    const res = await fetch("/api/admin/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allAgents: true, dailyReplyCap }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not set the limits");
      return;
    }
    load();
  }

  async function setCap(u: { id: string; email: string; profile?: { dailyReplyCap?: number | null } | null }) {
    const current = u.profile?.dailyReplyCap;
    const input = prompt(
      `Daily reply limit for ${u.email}.

Leave empty to use the platform default. 0 stops GC replying entirely.`,
      current == null ? "" : String(current)
    );
    if (input === null) return;
    const trimmed = input.trim();
    const dailyReplyCap = trimmed === "" ? null : Number(trimmed);
    if (dailyReplyCap !== null && (!Number.isInteger(dailyReplyCap) || dailyReplyCap < 0)) {
      setError("Enter a whole number, or leave it empty for the default");
      return;
    }
    const res = await fetch("/api/admin/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, dailyReplyCap }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not set the limit");
      return;
    }
    load();
  }

  async function setRole(u: { id: string; email: string; role: string }, role: string) {
    if (!confirm(`Change ${u.email} to ${role}?`)) return;
    const res = await fetch("/api/admin/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, role }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not change the role");
      return;
    }
    load();
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

      <ResetChatsCard />

      <DemoChatsCard />

      <InviteLinkCard />

      <SignupsCard onRegistered={load} />

      <SheetImportCard onRegistered={load} />

      <Card className="!border-[var(--accent)]/25 !bg-[var(--accent-soft)]/40 space-y-1.5">
        <h2 className="font-semibold text-sm">Where live customer chats land</h2>
        <p className="text-sm text-black/55">
          A WhatsApp, Messenger or Instagram connection belongs to ONE account, and its customer chats appear only in
          that account&apos;s Workspace. Nobody else can see them, not even an admin. The Channels column below shows who
          holds what. If chats are arriving on the wrong account, connect the channel again from the Connect page while
          logged in as the account you want them on.
        </p>
      </Card>

      <Card className="space-y-1.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-sm">Daily reply limits</h2>
            <p className="text-sm text-black/55">
              Every agent is capped at 100 GC replies a day, which is roughly RM5 of usage each. New accounts start
              there automatically. Click any number in the Daily limit column to change one agent, or set them all at
              once here.
            </p>
          </div>
          <Button onClick={setAllCaps}>Set every agent</Button>
        </div>
      </Card>

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
              <th className="px-4 py-3" title="Live customer chats only appear in the Workspace of the account holding the channel">
                Channels
              </th>
              <th className="px-4 py-3" title="Daily reply limit per agent — click a value to change it">
                Daily limit
              </th>
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
                <td className="px-4 py-3 text-xs">
                  {u.role}
                  {u.isOwner && (
                    <span className="ml-1.5 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-ink)]">
                      owner
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  {u.profile?.storeName || "—"}
                  {u.profile?.leaderName && (
                    <div className="text-[11px] text-black/40">under {u.profile.leaderName}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs tabular-nums">{u.profile?._count.orders ?? 0}</td>
                <td className="px-4 py-3 text-xs tabular-nums">{u.profile?._count.products ?? 0}</td>
                <td className="px-4 py-3 text-xs tabular-nums">{u.profile?._count.channels ?? 0}</td>
                <td className="px-4 py-3 text-xs tabular-nums">
                  <button
                    onClick={() => setCap(u)}
                    title="Daily reply limit for this agent. This is the cost control."
                    className="hover:underline text-[var(--accent-ink)]"
                  >
                    {u.profile?.dailyReplyCap ?? "default"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  {!u.isOwner && (
                  <button
                    onClick={() => setRole(u, u.role === "ADMIN" ? "AGENT" : "ADMIN")}
                    title="Only ADMIN accounts can see the Admin page and its tools"
                    className="mr-3 text-[11px] font-medium text-[var(--accent-ink)] hover:underline whitespace-nowrap"
                  >
                    {u.role === "ADMIN" ? "Make agent" : "Make admin"}
                  </button>
                  )}
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

      <SeedResultsCard />
      <ProductPhotosCard />
      <LearningCard />

      <ActivityTreeCard />

      <RecentErrorsCard />
    </div>
  );
}

type SheetAgent = {
  name: string;
  email: string;
  phone: string;
  leaderName?: string;
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
            body: JSON.stringify({ email: a.email, password: a.passcode, name: a.name, leaderName: a.leaderName, cloneCatalog: true }),
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

// One-click distribution of the curated MAE results bank (47 real, grounded
// customer results across all product lines) to every agent's Results library.
function SeedResultsCard() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function seed() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/seed-results", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Seeding failed");
        return;
      }
      // Report the quiet failures too — a skipped profile or an unmatched
      // category used to look identical to success.
      const parts = [
        `Added ${json.created} results across ${json.profiles} agent librar${json.profiles === 1 ? "y" : "ies"} (${json.skipped} already present).`,
      ];
      if (json.noCatalog) {
        parts.push(
          `${json.noCatalog} agent${json.noCatalog === 1 ? "" : "s"} skipped for having no products yet — push the catalog to them first, then run this again.`
        );
      }
      if (json.unmatchedCategories?.length) {
        parts.push(
          `No product matched these categories, so those results are filed under General: ${json.unmatchedCategories.join(", ")}.`
        );
      }
      setResult(parts.join(" "));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">MAE results bank</h2>
        <p className="text-sm text-black/45">
          Push 55 real, source-grounded customer results (BCODE+, Total DX+, BRB, Claríty, Re.WIND, iReason and more —
          from MAE&apos;s own training material and public reviews) into every agent&apos;s Results library. GC quotes them
          as social proof at closing moments. Safe to run again — duplicates are skipped and agents&apos; own entries are
          untouched.
        </p>
      </div>
      {result && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CheckIcon className="w-4 h-4 shrink-0" />
          {result}
        </div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <Button onClick={seed} disabled={busy}>
        {busy ? "Seeding…" : "Seed results to all agents"}
      </Button>
    </Card>
  );
}

// The sign-up page is useless if nobody can find the link. This makes it
// copyable, and hands over a WhatsApp message that is ready to paste, because
// "here is a URL, write your own invitation" is how a rollout stalls.
function InviteLinkCard() {
  const [copied, setCopied] = useState<string | null>(null);
  // Read from the browser rather than hardcoding, so it stays correct on a custom
  // domain or a preview deploy.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const joinUrl = `${origin}/join`;
  const invite =
    `Hi! You can get your own GC AI sales assistant.

` +
    `It answers your customers on WhatsApp in your name, in their language, 24 hours a day.

` +
    `Sign up here: ${joinUrl}

` +
    `Fill in your name, your leader's name, email and phone. I will approve it and you can start straight away. ` +
    `Your passcode is the last 6 digits of your phone number.`;

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied("failed");
    }
  }

  return (
    <Card className="space-y-3 !border-[var(--accent)]/25 !bg-[var(--accent-soft)]/40">
      <div>
        <h2 className="font-semibold">Invite your team</h2>
        <p className="text-sm text-black/55">
          Send this link to anyone who should have GC. They fill in four things, and their request lands in Sign-up
          requests below for you to approve.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 min-w-0 truncate rounded-xl border border-black/10 bg-white px-3 py-2 text-sm">
          {joinUrl}
        </code>
        <Button onClick={() => copy(joinUrl, "link")}>{copied === "link" ? "Copied" : "Copy link"}</Button>
        <button
          onClick={() => copy(invite, "message")}
          className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:border-[var(--accent)]"
        >
          {copied === "message" ? "Copied" : "Copy WhatsApp message"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(invite)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:border-[var(--accent)]"
        >
          Open in WhatsApp
        </a>
      </div>
      {copied === "failed" && (
        <p className="text-xs text-red-600">Could not copy automatically. Select the link above and copy it by hand.</p>
      )}
      <p className="text-xs text-black/40">
        The link is also on the login page, so anyone who lands there without an account can find it themselves.
      </p>
    </Card>
  );
}

// Requests from the public /join page. Approving here is the SAME path the Sheet
// import uses, so an account comes into existence exactly one way regardless of
// how the agent reached us.
function SignupsCard({ onRegistered }: { onRegistered: () => void }) {
  const [rows, setRows] = useState<Signup[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [approved, setApproved] = useState<Approved | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/signups");
    if (!res.ok) return;
    const json = await res.json();
    setRows(json.signups ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "approve" | "dismiss", email: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not do that");
      } else if (action === "approve") {
        const row = rows.find((r) => r.id === id);
        if (row) setApproved({ name: row.name, email: row.email, passcode: json.passcode, phone: row.phone });
        setResult(
          `${email} can sign in now, passcode ${json.passcode}. Copied over: ${json.products} products, ${json.results} customer results, ${json.menus} discovery menus.`
        );
        onRegistered();
      }
      load();
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <Card className="space-y-1.5">
        <h2 className="font-semibold">Sign-up requests</h2>
        <p className="text-sm text-black/45">
          Nothing waiting. Share <strong>gc-top-sales.onrender.com/join</strong> with your team and their requests
          appear here for you to approve.
        </p>
        {result && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <CheckIcon className="w-4 h-4 shrink-0" />
            {result}
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">
          Sign-up requests <span className="text-[var(--accent-ink)]">({rows.length})</span>
        </h2>
        <p className="text-sm text-black/45">
          From <strong>/join</strong>. Approving creates their workspace, copies your catalogue, and sets their passcode
          to the last 6 digits of their phone. Payment details are never copied, since those are personal.
        </p>
      </div>
      {result && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CheckIcon className="w-4 h-4 shrink-0" />
          {result}
        </div>
      )}
      {approved && (
        <div className="space-y-2 rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent-soft)]/40 p-3.5">
          <p className="text-sm font-medium">Send {approved.name.split(" ")[0]} their login</p>
          <p className="text-xs text-black/50">
            English and Chinese in one message, with their email and passcode already filled in, and the three things to
            do first.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/${waNumber(approved.phone)}?text=${encodeURIComponent(
                welcomeMessage({ ...approved, origin: typeof window === "undefined" ? "" : window.location.origin })
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-ink)_100%)] px-4 py-2 text-xs font-medium text-white hover:brightness-110"
            >
              Send on WhatsApp
            </a>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(
                  welcomeMessage({ ...approved, origin: window.location.origin })
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium hover:border-[var(--accent)]"
            >
              {copied ? "Copied" : "Copy the message"}
            </button>
          </div>
        </div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-black/[0.06] px-3 py-2.5 text-xs">
            <span className="font-medium">{r.name}</span>
            <span className="text-black/45">{r.email}</span>
            <span className="text-black/45">{r.phone}</span>
            {r.leaderName && (
              <span className={r.leaderKnown === false ? "text-amber-700" : "text-black/45"}>
                under {r.leaderName}
                {r.leaderKnown === false ? " (no agent by that name yet)" : ""}
              </span>
            )}
            {r.alreadyHasAccount && <span className="text-amber-700">already has an account</span>}
            {!r.passcode && <span className="text-red-600">phone too short for a passcode</span>}
            <span className="ml-auto flex gap-2">
              <button
                onClick={() => act(r.id, "approve", r.email)}
                disabled={busy !== null || !r.passcode}
                className="rounded-full bg-[var(--accent-soft)] px-3 py-1 font-medium text-[var(--accent-ink)] hover:bg-[var(--accent-soft-2)] disabled:opacity-40"
              >
                {busy === r.id ? "…" : "Approve"}
              </button>
              <button
                onClick={() => act(r.id, "dismiss", r.email)}
                disabled={busy !== null}
                className="text-black/40 hover:text-black/70 disabled:opacity-40"
              >
                Dismiss
              </button>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

type Approved = { name: string; email: string; passcode: string; phone: string };

type Signup = {
  id: string;
  name: string;
  email: string;
  phone: string;
  leaderName: string | null;
  leaderKnown: boolean | null;
  passcode: string | null;
  alreadyHasAccount: boolean;
};

// Angi's account is the master, and the master account is what people get shown.
// So it needs conversations in it that GC actually wrote, not an empty Workspace
// and a promise.
function DemoChatsCard() {
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<DemoResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function build() {
    setError(null);
    setResults([]);
    const scenarios = [0, 1, 2, 3];
    for (const i of scenarios) {
      setBusy(`Chat ${i + 1} of 4, GC is having the conversation…`);
      try {
        const res = await fetch("/api/admin/demo-chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario: i }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Could not build the demo chats");
          break;
        }
        setResults((r) => [...r, json as DemoResult]);
      } catch {
        setError("Could not reach the server");
        break;
      }
    }
    setBusy(null);
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">The 4 demo chats</h2>
        <p className="text-sm text-black/45">
          Builds four conversations in THIS account&apos;s Workspace, ready to open: skincare from a post reply, hair
          fall, bloating, and stress in Mandarin. They are real, not scripted, every turn goes through the same engine a
          WhatsApp customer hits, so nobody is ever shown a reply GC did not write. Takes a minute or two. Running it
          again replaces the previous four rather than piling up copies.
        </p>
      </div>
      {busy && <div className="text-sm text-black/45">{busy}</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {results.length > 0 && (
        <div className="space-y-1.5 text-xs">
          {results.map((r) => (
            <div key={r.label} className="flex flex-wrap items-center gap-2 rounded-xl border border-black/[0.06] px-3 py-2">
              <span className="font-medium">{r.label}</span>
              <span className="text-black/40">
                bubbles {r.bubbles.join(", ")} · emoji {r.emoji.join(", ")} · {r.images} image{r.images === 1 ? "" : "s"}
              </span>
              {/* Whatever failed this run, named. Empty means the shape rules held. */}
              {r.problems.length === 0 ? (
                <span className="text-emerald-700">shape rules held{r.testedHesitation ? ", hesitation included" : ""}</span>
              ) : (
                r.problems.map((prob) => (
                  <span key={prob} className="text-red-600">
                    {prob}
                  </span>
                ))
              )}
            </div>
          ))}
        </div>
      )}
      <Button onClick={build} disabled={busy !== null}>
        {busy ? "Building…" : "Build the 4 demo chats"}
      </Button>
    </Card>
  );
}

type DemoResult = {
  label: string;
  bubbles: number[];
  emoji: number[];
  images: number;
  testedHesitation: boolean;
  problems: string[];
};

// Handing the app to a tester means handing over somebody else's practice chats
// too. This clears the history without touching the catalogue, the results bank
// or the library — the tester keeps a fully-loaded GC with an empty inbox.
function ResetChatsCard() {
  const [counts, setCounts] = useState<{ willDelete: Record<string, number>; willKeep: Record<string, number> } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const PHRASE = "DELETE ALL CHATS";
  const [armed, setArmed] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/reset-chats");
    if (res.ok) setCounts(await res.json());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function wipe() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reset-chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Reset failed");
        return;
      }
      const d = json.deleted as Record<string, number>;
      setResult(
        `Cleared ${d.orders} chat${d.orders === 1 ? "" : "s"} and ${d.messages} messages. ` +
          `Catalogue, results, library and settings untouched.`
      );
      setConfirm("");
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">Start every inbox from zero</h2>
        <p className="text-sm text-black/45">
          Deletes all chats, messages, orders, learning cases and the error log across every agent, so a tester opens a
          clean Workspace. Keeps everything GC needs in order to sell: the catalogue and photos, the results bank, the
          media library, discovery menus, training examples, channel connections and each agent&apos;s settings. This
          cannot be undone.
        </p>
      </div>
      {!armed ? (
        <button onClick={() => setArmed(true)} className="text-sm font-medium text-red-700 hover:underline self-start">
          Show the clear button
        </button>
      ) : (
        <>
      {counts && (
        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="font-medium text-red-900">Will be deleted</p>
            {Object.entries(counts.willDelete).map(([k, v]) => (
              <p key={k} className="text-red-800/70">
                {v} {k.replace(/([A-Z])/g, " $1").toLowerCase()}
              </p>
            ))}
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="font-medium text-emerald-900">Will be kept</p>
            {Object.entries(counts.willKeep).map(([k, v]) => (
              <p key={k} className="text-emerald-800/70">
                {v} {k.replace(/([A-Z])/g, " $1").toLowerCase()}
              </p>
            ))}
          </div>
        </div>
      )}
      {result && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CheckIcon className="w-4 h-4 shrink-0" />
          {result}
        </div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={`Type ${PHRASE}`}
          className={inputClass + " max-w-xs"}
        />
        <Button onClick={wipe} disabled={busy || confirm !== PHRASE}>
          {busy ? "Clearing…" : "Clear all chat history"}
        </Button>
        <button onClick={() => setArmed(false)} className="text-sm text-black/40 hover:text-black/70">
          Hide
        </button>
      </div>
        </>
      )}
    </Card>
  );
}

// Products with no photo were the single biggest credibility hole: GC was quoting
// RM488 with no visual at all, which reads as a scam to a chat buyer.
function ProductPhotosCard() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function push() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/push-product-photos", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Push failed");
        return;
      }
      const parts = [`Added a photo to ${json.created} product${json.created === 1 ? "" : "s"}.`];
      if (json.alreadyHad) parts.push(`${json.alreadyHad} already had one and were left alone.`);
      if (json.unmappedSeries?.length) {
        parts.push(`No photo mapped for: ${json.unmappedSeries.join(", ")} — upload one on the Products page.`);
      }
      setResult(parts.join(" "));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">Product photos GC can send</h2>
        <p className="text-sm text-black/45">
          GC can only send pictures that exist in the catalogue. Any product without one gets quoted with no visual at
          all, which is the fastest way to lose a chat buyer at this price. This gives every product the official MAE
          product-line photo as a floor. Replace them with your own, better shots per SKU on the Products page. Safe to
          run again — products that already have a photo are untouched.
        </p>
      </div>
      {result && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CheckIcon className="w-4 h-4 shrink-0" />
          {result}
        </div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <Button onClick={push} disabled={busy}>
        {busy ? "Pushing…" : "Give every product a photo"}
      </Button>
    </Card>
  );
}

// The Learning Hub only has something to teach once cases exist. Cases also build
// nightly via the cron, but an admin wants to see it work immediately.
function LearningCard() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function build() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/learning", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Build failed");
        return;
      }
      setResult(
        `Scanned ${json.scanned} closed orders: ${json.created} new case${json.created === 1 ? "" : "s"}, ` +
          `${json.updated} updated, ${json.skipped} skipped (too short or unchanged).`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">Learning Hub cases</h2>
        <p className="text-sm text-black/45">
          Turns real won and lost conversations into teaching cases, with names and phone numbers stripped out. Runs
          nightly on its own; this builds them now. Losses are included on purpose — that is usually where the
          transferable lesson is.
        </p>
      </div>
      {result && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CheckIcon className="w-4 h-4 shrink-0" />
          {result}
        </div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <Button onClick={build} disabled={busy}>
        {busy ? "Studying…" : "Build learning cases now"}
      </Button>
    </Card>
  );
}

type TreeAgent = {
  profileId: string;
  name: string;
  email: string;
  role: string;
  storeName: string | null;
  total: number;
  paid: number;
  needsHuman: number;
  recent: {
    id: string;
    customer: string;
    status: string;
    converted: boolean;
    needsHuman: boolean;
    totalMyr: number | null;
    leadSource: string | null;
    updatedAt: string;
    summary: string | null;
  }[];
};

// The "what is going on" tree: each agent expands into their live pipeline.
function ActivityTreeCard() {
  const [agents, setAgents] = useState<TreeAgent[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/overview");
      if (res.ok) setAgents((await res.json()).agents ?? []);
    })();
  }, []);

  return (
    <Card padding="none">
      <div className="px-5 py-4 border-b border-black/[0.06]">
        <h2 className="font-semibold">Team activity</h2>
        <p className="text-sm text-black/45 mt-0.5">
          Click an agent to see what&apos;s happening inside their workspace right now.
        </p>
      </div>
      {agents.length === 0 && <p className="px-5 py-4 text-xs text-black/40">Loading team…</p>}
      <ul className="divide-y divide-black/[0.05]">
        {agents.map((a) => {
          const open = openId === a.profileId;
          return (
            <li key={a.profileId}>
              <button
                onClick={() => setOpenId(open ? null : a.profileId)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-black/[0.02] transition-colors"
              >
                <span className={"text-xs transition-transform " + (open ? "rotate-90" : "")}>▸</span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{a.name}</span>
                  {a.role === "ADMIN" && (
                    <span className="ml-2 text-[10px] font-bold uppercase text-[var(--accent-ink)] bg-[var(--accent-soft)] rounded-full px-1.5 py-0.5">
                      admin
                    </span>
                  )}
                  <span className="block text-[11px] text-black/40 truncate">{a.storeName || a.email}</span>
                </span>
                <span className="flex items-center gap-3 text-xs shrink-0">
                  <span className="text-black/45">
                    <span className="num font-semibold text-black/70">{a.total}</span> chats
                  </span>
                  <span className="text-emerald-700">
                    <span className="num font-semibold">{a.paid}</span> converted
                  </span>
                  {a.needsHuman > 0 && (
                    <span className="text-amber-600">
                      <span className="num font-semibold">{a.needsHuman}</span> need help
                    </span>
                  )}
                </span>
              </button>
              {open && (
                <div className="px-5 pb-4 pl-12">
                  {a.recent.length === 0 ? (
                    <p className="text-xs text-black/35">No conversations yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {a.recent.map((o) => (
                        <li key={o.id} className="flex items-center gap-2.5 text-xs rounded-lg bg-black/[0.02] px-3 py-2">
                          <span
                            className={
                              "w-1.5 h-1.5 rounded-full shrink-0 " +
                              (o.converted ? "bg-emerald-500" : o.needsHuman ? "bg-amber-500" : o.status === "Lost" ? "bg-red-400" : "bg-[var(--accent)]")
                            }
                          />
                          <span className="font-medium truncate max-w-[10rem]">{o.customer}</span>
                          <span className="text-black/45 shrink-0">{o.status}</span>
                          {o.leadSource && <span className="text-black/35 shrink-0">via {o.leadSource}</span>}
                          {o.totalMyr ? <span className="num text-black/55 shrink-0">RM{o.totalMyr.toLocaleString()}</span> : null}
                          <span className="ml-auto text-black/30 shrink-0">{new Date(o.updatedAt).toLocaleDateString()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
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
