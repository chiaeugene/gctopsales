"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CheckIcon, AlertIcon } from "@/components/ui/icons";

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
  const [info, setInfo] = useState<Info | null>(null);
  const [tab, setTab] = useState<"WHATSAPP" | "MESSENGER" | "INSTAGRAM">("WHATSAPP");
  const [form, setForm] = useState({ externalId: "", accessToken: "", displayName: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        body: JSON.stringify({ channel: tab, ...form, displayName: form.displayName || undefined }),
      });
      if (!res.ok) {
        setError((await res.json()).error || "Failed to connect");
        return;
      }
      setForm({ externalId: "", accessToken: "", displayName: "" });
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
    <div className="max-w-3xl space-y-5">
      <PageHeader
        title="Connect your channels"
        subtitle="Connect WhatsApp, Instagram DM, and Facebook Messenger so GC replies to your customers automatically. You'll paste credentials from your own Meta account — a 5-10 minute one-time setup per channel."
      />

      <div className="flex gap-2">
        {(["WHATSAPP", "MESSENGER", "INSTAGRAM"] as const).map((c) => (
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
            <label className="block text-xs md:col-span-2">
              <span className="text-black/45">Access token (stored securely server-side, never shown again)</span>
              <input required type="password" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} className={inputClass} />
            </label>
            {error && <p className="text-xs text-red-600 md:col-span-2">{error}</p>}
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Connecting…" : "Connect"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <p className="text-xs text-black/35">
        One-click connect (Meta Embedded Signup) is coming — it removes the token copying once our Meta app finishes
        review. Until then, this manual connect works fully.
      </p>
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
