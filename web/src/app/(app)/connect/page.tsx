"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { CheckIcon, AlertIcon } from "@/components/ui/icons";
import { MetaConnectButtons, MESSENGER_IG_APPROVED } from "@/components/MetaConnectButtons";
import { BotHealth } from "@/components/BotHealth";

const META_APP_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_META_APP_ID);

type Conn = { channel: string; externalId: string; displayName: string | null; isActive: boolean } | null;
type Info = {
  whatsappWebhookUrl: string;
  metaWebhookUrl: string;
  verifyToken: string;
  connected: { WHATSAPP: Conn; MESSENGER: Conn; INSTAGRAM: Conn };
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow";

export default function ConnectPage() {
  const { t } = useT();
  const [info, setInfo] = useState<Info | null>(null);
  const [tab, setTab] = useState<"WHATSAPP" | "MESSENGER" | "INSTAGRAM">("WHATSAPP");
  const [form, setForm] = useState({ externalId: "", accessToken: "", displayName: "", wabaId: "" });
  const [connectResult, setConnectResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showManual, setShowManual] = useState(!META_APP_CONFIGURED);

  async function load() {
    const res = await fetch("/api/connect-info");
    if (res.ok) setInfo(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: tab,
          ...form,
          displayName: form.displayName || undefined,
          wabaId: form.wabaId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to connect");
        return;
      }
      if (tab === "WHATSAPP") {
        setConnectResult(
          `Saved. Inbound messages: ${json.subscribed === true ? "subscribed ✓" : json.subscribed === false ? `FAILED (${json.detail ?? "check the WABA ID"})` : "not subscribed (no WABA ID given)"} · Sending: ${json.registered ? "registered ✓" : "registration failed"}`
        );
      }
      setForm({ externalId: "", accessToken: "", displayName: "", wabaId: "" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(channel: string, externalId: string) {
    // find id via channels API
    const res = await fetch("/api/settings");
    const s = await res.json();
    const conn = s.channels?.find((c: { channel: string; externalId: string; id: string }) => c.channel === channel && c.externalId === externalId);
    if (conn) {
      await fetch("/api/channels", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: conn.id }) });
      await load();
    }
  }

  if (!info) return <div className="text-sm text-black/40">Loading…</div>;

  const connected = info.connected[tab];
  const idLabel =
    tab === "WHATSAPP" ? "Phone number ID" : tab === "MESSENGER" ? "Facebook Page ID" : "Instagram account ID";
  const webhookUrl = tab === "WHATSAPP" ? info.whatsappWebhookUrl : info.metaWebhookUrl;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <PageHeader
        title="Connect your channels"
        subtitle="Soon GC will reply on your WhatsApp, Instagram DM, and Facebook Messenger completely by itself. Here's what's coming and how to be ready."
      />

      {/* Roadmap framing: auto-connect is a launching-soon feature, the
          Workspace is today's mode. */}
      <Card className="space-y-3 !border-[var(--accent)]/25 !bg-[var(--accent-soft)]/40">
        <h2 className="font-semibold flex items-center gap-2">
          Auto-reply on your channels
          <span className="text-[10px] font-bold uppercase tracking-wide text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">
            Releasing soon · 即将推出
          </span>
        </h2>
        <p className="text-sm text-black/55">
          One-click connection for WhatsApp, Instagram and Messenger is built and waiting on Meta&apos;s business
          verification of our platform. The moment it clears, you&apos;ll connect each channel in a single click here and
          GC starts replying to customers automatically, day and night.
        </p>
        <p className="text-sm text-black/55">
          <strong>Until then, nothing is lost:</strong> the{" "}
          <a href="/playground" className="text-[var(--accent-ink)] underline underline-offset-2">GC Workspace</a> is
          your cockpit — paste each customer message in, copy GC&apos;s reply back. Same brain, same selling power, just
          with you as the messenger. Everything GC learns now carries over the day channels go live.
        </p>
      </Card>

      {info.connected.WHATSAPP && <WhatsAppActivateCard connection={info.connected.WHATSAPP} />}

      {!MESSENGER_IG_APPROVED && (
        <Card className="space-y-1 !border-black/[0.06]">
          <h2 className="font-semibold text-sm">WhatsApp only, for now</h2>
          <p className="text-sm text-black/55">
            Facebook Messenger and Instagram are built and waiting on Meta&apos;s approval, the same review WhatsApp has
            already passed. They will appear here the moment it comes through. Nothing you set up now needs redoing.
          </p>
        </Card>
      )}

      {/* Real feedback from the first batch: an agent stalled on Meta's business
          step because Website is required and nothing says so. Everything here is
          a thing that stops the flow dead, in the order it is met. */}
      <Card className="space-y-2">
        <h2 className="font-semibold text-sm">{t("connect.help.title")}</h2>
        <ul className="space-y-1.5">
          {["connect.help.a", "connect.help.b", "connect.help.c", "connect.help.d"].map((k) => (
            <li key={k} className="flex gap-2.5 text-sm text-black/60">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
              <span>{t(k)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <BotHealth />

      {META_APP_CONFIGURED && <MetaConnectButtons onConnected={load} />}

      <button
        onClick={() => setShowManual((v) => !v)}
        className="text-xs font-medium text-black/40 hover:text-[var(--accent-ink)] transition-colors"
      >
        {showManual ? "Hide" : META_APP_CONFIGURED ? "Advanced: connect manually instead" : "Manual setup"}
      </button>

      {showManual && (
        <>
      <div className="flex gap-2">
        {(MESSENGER_IG_APPROVED ? (["WHATSAPP", "MESSENGER", "INSTAGRAM"] as const) : (["WHATSAPP"] as const)).map((c) => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={
              "rounded-full px-4 py-2 text-sm font-medium transition-colors inline-flex items-center gap-1.5 " +
              (tab === c ? "bg-[var(--ink)] text-white" : "bg-white border border-black/[0.08] text-black/60 hover:bg-black/[0.03]")
            }
          >
            {c === "WHATSAPP" ? "WhatsApp" : c === "MESSENGER" ? "Messenger" : "Instagram"}
            {info.connected[c] && <CheckIcon className="w-3.5 h-3.5" />}
          </button>
        ))}
      </div>

      {connected ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <span className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4 shrink-0" />
            Connected: <strong>{connected.displayName || connected.externalId}</strong>
          </span>
          <button onClick={() => disconnect(tab, connected.externalId)} className="text-red-600 hover:underline text-xs">
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <AlertIcon className="w-3.5 h-3.5 shrink-0" />
          Not connected yet — follow the steps below.
        </div>
      )}

      {/* Step-by-step guide */}
      <Card className="space-y-4">
        <h2 className="font-semibold">{tab === "WHATSAPP" ? "WhatsApp Business" : tab === "MESSENGER" ? "Facebook Messenger" : "Instagram DM"} setup</h2>

        {tab === "WHATSAPP" && (
          <Steps
            steps={[
              "Go to developers.facebook.com → your Business app → add the WhatsApp product (or create a Business app first).",
              "In WhatsApp → API Setup, copy your Phone number ID (a long number under the test/live number).",
              "Generate a permanent access token: create a System User in Meta Business Settings, assign your WhatsApp Business Account, and generate a token with whatsapp_business_messaging + whatsapp_business_management permissions. (The temporary 24h token works for testing.)",
              "In WhatsApp → Configuration, set the Callback URL and Verify token below, then click Verify and save.",
              "Subscribe the webhook to the messages field.",
              "Paste your Phone number ID + token below and click Connect.",
            ]}
          />
        )}
        {tab === "MESSENGER" && (
          <Steps
            steps={[
              "developers.facebook.com → your app → add the Messenger product.",
              "Under Messenger → Settings, link your Facebook Page and generate a Page access token.",
              "Copy your Page ID (from your Page's About section, or Meta Business Settings).",
              "Set the Callback URL + Verify token below in Messenger → Settings → Webhooks, verify, and subscribe your Page to the messages and messaging_postbacks fields.",
              "Paste your Page ID + Page token below and click Connect.",
            ]}
          />
        )}
        {tab === "INSTAGRAM" && (
          <Steps
            steps={[
              "Convert your Instagram to a Professional (Business) account and link it to a Facebook Page.",
              "developers.facebook.com → your app → add the Instagram product; connect the same Page.",
              "Generate a Page access token (Instagram messaging uses the linked Page's token).",
              "Copy your Instagram account ID (Instagram-scoped id from the linked Page / Graph API).",
              "Set the Callback URL + Verify token below, verify, and subscribe to the messages field for Instagram.",
              "Paste your Instagram account ID + Page token below and click Connect.",
            ]}
          />
        )}

        {/* Copyable webhook config */}
        <div className="space-y-2 border-t border-black/[0.06] pt-3">
          <CopyRow label="Callback / Webhook URL" value={webhookUrl} />
          <CopyRow label="Verify token" value={info.verifyToken} />
        </div>
      </Card>

      {/* Connect form */}
      {!connected && (
        <Card padding="none">
          <form onSubmit={connect} className="grid md:grid-cols-2 gap-3 p-5">
            <h2 className="font-semibold md:col-span-2">Enter your {tab === "WHATSAPP" ? "WhatsApp" : tab === "MESSENGER" ? "Messenger" : "Instagram"} credentials</h2>
            <label className="block text-xs">
              <span className="text-black/45">{idLabel}</span>
              <input required value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} className={inputClass} />
            </label>
            <label className="block text-xs">
              <span className="text-black/45">Display name (optional)</span>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={inputClass} />
            </label>
            {tab === "WHATSAPP" && (
              <label className="block text-xs md:col-span-2">
                <span className="text-black/45">
                  WhatsApp Business Account ID <strong>(required for GC to receive messages)</strong>
                </span>
                <input
                  value={form.wabaId}
                  onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
                  placeholder="e.g. 1736816070840085 — shown next to your Phone number ID in Meta"
                  className={inputClass}
                />
              </label>
            )}
            <label className="block text-xs md:col-span-2">
              <span className="text-black/45">Access token (stored securely server-side, never shown again)</span>
              <input required type="password" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} className={inputClass} />
            </label>
            {error && <p className="text-xs text-red-600 md:col-span-2">{error}</p>}
            {connectResult && <p className="text-xs font-medium text-[var(--accent-ink)] md:col-span-2">{connectResult}</p>}
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Connecting…" : "Connect"}
              </Button>
            </div>
          </form>
        </Card>
      )}
        </>
      )}
    </div>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--accent-soft)] text-[var(--accent-ink)] text-xs font-bold flex items-center justify-center">
            {i + 1}
          </span>
          <span className="text-black/70">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-black/45 w-40 shrink-0">{label}</span>
      <code className="flex-1 text-xs bg-black/[0.04] rounded-lg px-2 py-1.5 truncate">{value}</code>
      <Button
        variant="secondary"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="!px-2.5 !py-1.5 !text-xs"
      >
        {copied ? (
          <span className="inline-flex items-center gap-1">
            <CheckIcon className="w-3.5 h-3.5" /> Copied
          </span>
        ) : (
          "Copy"
        )}
      </Button>
    </div>
  );
}

// One-click Cloud API registration for a connected WhatsApp number. Numbers
// onboarded through Embedded Signup must be registered before they can send
// or receive — this retries it any time (idempotent, safe).
type RepairReport = {
  phoneNumberId: string;
  number: string | null;
  verifiedName: string | null;
  platform: string | null;
  tokenValid: boolean;
  tokenDetail: string | null;
  tokenExpiresInDays: number | null;
  tokenNeverExpires: boolean;
  wabaIds: string[];
  subscriptions: { wabaId: string; ok: boolean; detail?: string }[];
  registered: boolean;
  registerDetail: string | null;
};

function WhatsAppActivateCard({ connection }: { connection: NonNullable<Conn> }) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<RepairReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/channels/whatsapp/repair", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Activation failed");
        return;
      }
      setReport(json.results?.[0] ?? null);
    } finally {
      setBusy(false);
    }
  }

  const subsOk = report ? report.subscriptions.length > 0 && report.subscriptions.every((s) => s.ok) : false;
  const allGood = report ? report.tokenValid && subsOk && report.registered : false;

  return (
    <Card className="!border-emerald-200 !bg-emerald-50/60 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-emerald-900">
          <span className="font-semibold">WhatsApp connected:</span> {connection.displayName || connection.externalId}
        </div>
        <Button onClick={activate} disabled={busy} className="!px-4 !py-1.5 !text-xs">
          {busy ? "Checking…" : "Activate & check"}
        </Button>
      </div>
      <p className="text-xs text-emerald-800/80">
        Press this once after connecting. It subscribes GC to your WhatsApp account (so messages reach GC), registers
        the number for sending, and reports anything still broken.
      </p>

      {error && <p className="text-xs font-medium text-red-700">{error}</p>}

      {report && (
        <div className="rounded-xl bg-white/80 border border-emerald-200 p-3 space-y-1.5 text-xs">
          <CheckLine ok={report.tokenValid} label="Credentials valid">
            {report.tokenValid
              ? `${report.number ?? report.phoneNumberId}${report.verifiedName ? ` · ${report.verifiedName}` : ""}${
                  report.tokenNeverExpires
                    ? " · token never expires"
                    : report.tokenExpiresInDays !== null
                      ? ` · token good for ${report.tokenExpiresInDays} more days`
                      : ""
                }`
              : `${report.tokenDetail} — press "Connect with Facebook" below to reconnect.`}
          </CheckLine>
          <CheckLine ok={subsOk} label="Receiving messages (webhook subscribed)">
            {report.wabaIds.length === 0
              ? "No WhatsApp account found on this token — reconnect using Connect with Facebook."
              : report.subscriptions.map((s) => `${s.wabaId}${s.ok ? "" : `: ${s.detail}`}`).join(", ")}
          </CheckLine>
          <CheckLine ok={report.registered} label="Sending enabled (number registered)">
            {report.registerDetail}
          </CheckLine>
          <p className={"pt-1 font-medium " + (allGood ? "text-emerald-800" : "text-amber-700")}>
            {allGood
              ? `All set. WhatsApp ${report.number ?? "your number"} now and GC will reply.`
              : "Something above is still red — send that line to your developer."}
          </p>
        </div>
      )}
    </Card>
  );
}

function CheckLine({ ok, label, children }: { ok: boolean; label: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className={"shrink-0 font-bold " + (ok ? "text-emerald-600" : "text-red-600")}>{ok ? "✓" : "✗"}</span>
      <span className="min-w-0">
        <span className="font-medium text-black/75">{label}</span>
        {children ? <span className="block text-black/45 break-all">{children}</span> : null}
      </span>
    </div>
  );
}
