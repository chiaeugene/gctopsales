"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AlertIcon, CheckIcon } from "@/components/ui/icons";

type Channel = { id: string; channel: string; externalId: string; displayName: string | null; isActive: boolean };
type Settings = {
  storeName: string | null;
  agentName: string | null;
  homeMarket: string;
  marketsServed: string[];
  identityBrain: Record<string, string>;
  salesBrain: Record<string, string>;
  fulfillmentBrain: Record<string, string>;
  catalogRules: Record<string, string>;
  tone: string;
  autoConfirmPayments: boolean;
  followUpAfterHours: number | null;
  maxFollowUps: number;
  channels: Channel[];
};

const BRAIN_FIELDS: Record<string, { key: string; label: string }[]> = {
  identityBrain: [
    { key: "storeName", label: "Store name" },
    { key: "targetCustomer", label: "Target customer" },
    { key: "brandPersonality", label: "Brand personality" },
    { key: "toneOfVoice", label: "Tone of voice" },
    { key: "languageStyle", label: "Language style" },
    { key: "differentiators", label: "Differentiators" },
    { key: "offerings", label: "What we offer" },
  ],
  salesBrain: [
    { key: "discountRules", label: "Discount rules" },
    { key: "followUpRules", label: "Follow-up rules" },
    { key: "objectionStyle", label: "Objection handling style" },
    { key: "conversationStrategy", label: "Discovery strategy" },
    { key: "upsellStrategy", label: "Upsell strategy" },
    { key: "allowedToSay", label: "Encouraged to say" },
    { key: "neverSay", label: "Never say" },
    { key: "salesPressure", label: "Sales pressure (soft/balanced/assertive)" },
  ],
  fulfillmentBrain: [
    { key: "paymentMethods", label: "Payment methods (used by proof verification!)" },
    { key: "paymentInstructions", label: "Payment instructions" },
    { key: "codRules", label: "COD rules" },
    { key: "shippingPolicy", label: "Shipping policy" },
    { key: "shippingFeeRules", label: "Shipping fee rules" },
    { key: "deliveryTimeline", label: "Delivery timeline" },
    { key: "returnRefundPolicy", label: "Return/refund policy" },
    { key: "humanOnlyTopics", label: "Human-only topics" },
  ],
  catalogRules: [
    { key: "currentPromotions", label: "Current promotions THIS MONTH (update monthly — GC pushes these)" },
    { key: "bundleRules", label: "Bundle rules" },
    { key: "membershipPitch", label: "Membership pricing story" },
    { key: "loyaltyProgram", label: "Loyalty program talking points" },
    { key: "authenticityGuarantee", label: "Authenticity guarantee" },
    { key: "complianceRules", label: "Health-claim compliance rules" },
  ],
};

const BRAIN_TITLES: Record<string, string> = {
  identityBrain: "Identity Brain",
  salesBrain: "Sales Brain",
  fulfillmentBrain: "Fulfillment Brain",
  catalogRules: "Catalog Rules",
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCard, setSavedCard] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/settings");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to load settings");
      return;
    }
    setSettings(json);
  }
  useEffect(() => {
    load();
  }, []);

  async function save(card: string, payload: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setError((await res.json()).error || "Save failed");
      return;
    }
    setSavedCard(card);
    setTimeout(() => setSavedCard(null), 2000);
  }

  if (!settings) return <div className="text-sm text-black/40">{error || "Loading…"}</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Settings" />
      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* Markets */}
      <MarketsCard
        homeMarket={settings.homeMarket}
        marketsServed={settings.marketsServed}
        saved={savedCard === "markets"}
        onSave={(v) => save("markets", v)}
      />

      {/* Tone */}
      <ToneCard tone={settings.tone} saved={savedCard === "tone"} onSave={(v) => save("tone", { tone: v })} />


      {/* Channels */}
      <ChannelsCard channels={settings.channels} onChanged={load} />

      {/* Brains */}
      {(Object.keys(BRAIN_FIELDS) as (keyof typeof BRAIN_FIELDS)[]).map((brainKey) => (
        <BrainCard
          key={brainKey}
          title={BRAIN_TITLES[brainKey]}
          fields={BRAIN_FIELDS[brainKey]}
          values={settings[brainKey as keyof Settings] as Record<string, string>}
          saved={savedCard === brainKey}
          onSave={(values) => save(brainKey, { [brainKey]: values })}
        />
      ))}

      {/* Follow-ups */}
      <FollowUpCard
        followUpAfterHours={settings.followUpAfterHours}
        maxFollowUps={settings.maxFollowUps}
        saved={savedCard === "followups"}
        onSave={(v) => save("followups", v)}
      />

      {/* Risky toggle */}
      <Card className="!border-amber-200 !bg-amber-50 space-y-3">
        <h2 className="font-semibold text-amber-900 flex items-center gap-2">
          <AlertIcon className="w-4 h-4 shrink-0" />
          Auto-confirm payments (high risk, off by default)
        </h2>
        <p className="text-sm text-amber-800">
          When ON, a payment-proof screenshot that passes AI vision verification — recipient matches your configured
          payment details AND the amount exactly matches the order total AND confidence ≥ 85% — auto-confirms the order
          without waiting for you. Fake or edited screenshots are a real risk; anything uncertain still comes to you.
          Requires your payment methods to be configured accurately above.
        </p>
        <label className="flex items-center gap-2 text-sm font-medium text-amber-900">
          <input
            type="checkbox"
            checked={settings.autoConfirmPayments}
            onChange={(e) => {
              setSettings({ ...settings, autoConfirmPayments: e.target.checked });
              save("autoconfirm", { autoConfirmPayments: e.target.checked });
            }}
          />
          Enable AI auto-confirm
          {savedCard === "autoconfirm" && (
            <span className="inline-flex items-center gap-1 text-emerald-700 text-xs">
              <CheckIcon className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </label>
      </Card>
    </div>
  );
}

const MARKET_LABELS: Record<string, string> = { MY: "Malaysia (RM)", SG: "Singapore (S$)", BN: "Brunei (RM store)" };

const TONE_OPTIONS = [
  { value: "professional", label: "Professional", desc: "Polished & courteous — a knowledgeable consultant. Minimal slang. (Recommended default.)" },
  { value: "balanced", label: "Balanced", desc: "Warm and friendly with light local flavour where it fits." },
  { value: "local", label: "Local", desc: "Full local personality — Manglish / Singlish / Malay slang. Feels like a local friend." },
];

function SaveButton({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <Button variant="secondary" onClick={onClick} className="!px-4 !py-1.5 !text-xs">
      {saved ? (
        <span className="inline-flex items-center gap-1">
          <CheckIcon className="w-3.5 h-3.5" /> Saved
        </span>
      ) : (
        "Save"
      )}
    </Button>
  );
}

function ToneCard(props: { tone: string; saved: boolean; onSave: (v: string) => void }) {
  const [tone, setTone] = useState(props.tone);
  useEffect(() => setTone(props.tone), [props.tone]);
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">GC&apos;s tone of voice</h2>
      <p className="text-sm text-black/45">
        How casual or professional GC sounds. She always replies in the customer&apos;s language (English / Mandarin /
        Malay) and market — this just sets how much local slang she uses.
      </p>
      <div className="space-y-2">
        {TONE_OPTIONS.map((o) => (
          <label
            key={o.value}
            className={
              "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors " +
              (tone === o.value ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-black/[0.08] hover:bg-black/[0.02]")
            }
          >
            <input type="radio" name="tone" checked={tone === o.value} onChange={() => setTone(o.value)} className="mt-1" />
            <span>
              <span className="text-sm font-medium">{o.label}</span>
              <span className="block text-xs text-black/45">{o.desc}</span>
            </span>
          </label>
        ))}
      </div>
      <SaveButton saved={props.saved} onClick={() => props.onSave(tone)} />
    </Card>
  );
}

function MarketsCard(props: {
  homeMarket: string;
  marketsServed: string[];
  saved: boolean;
  onSave: (v: { homeMarket: string; marketsServed: string[] }) => void;
}) {
  const [home, setHome] = useState(props.homeMarket);
  const [served, setServed] = useState<string[]>(props.marketsServed);
  useEffect(() => {
    setHome(props.homeMarket);
    setServed(props.marketsServed);
  }, [props.homeMarket, props.marketsServed]);

  function toggle(m: string) {
    setServed((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Markets you sell to</h2>
      <p className="text-sm text-black/45">
        GC quotes the right currency and shipping per customer. Malaysia &amp; Brunei use the RM store; Singapore is a
        separate S$ store. When you serve more than one, GC confirms the customer&apos;s country before quoting.
      </p>
      <div className="flex flex-wrap gap-4">
        {["MY", "SG", "BN"].map((m) => (
          <label key={m} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={served.includes(m)} onChange={() => toggle(m)} />
            {MARKET_LABELS[m]}
          </label>
        ))}
      </div>
      <label className="block text-xs">
        <span className="text-black/45">Home market (default currency)</span>
        <select value={home} onChange={(e) => setHome(e.target.value)} className={inputClass + " w-56"}>
          {["MY", "SG", "BN"].map((m) => (
            <option key={m} value={m}>
              {MARKET_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
      <SaveButton saved={props.saved} onClick={() => props.onSave({ homeMarket: home, marketsServed: served.length ? served : ["MY"] })} />
    </Card>
  );
}

function BrainCard(props: {
  title: string;
  fields: { key: string; label: string }[];
  values: Record<string, string>;
  saved: boolean;
  onSave: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState(props.values);
  useEffect(() => setValues(props.values), [props.values]);
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{props.title}</h2>
        <SaveButton saved={props.saved} onClick={() => props.onSave(values)} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {props.fields.map((f) => (
          <label key={f.key} className="block text-xs">
            <span className="text-black/45">{f.label}</span>
            <textarea
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              rows={3}
              className={inputClass}
            />
          </label>
        ))}
      </div>
    </Card>
  );
}

function FollowUpCard(props: {
  followUpAfterHours: number | null;
  maxFollowUps: number;
  saved: boolean;
  onSave: (v: { followUpAfterHours: number | null; maxFollowUps: number }) => void;
}) {
  const [hours, setHours] = useState(props.followUpAfterHours);
  const [max, setMax] = useState(props.maxFollowUps);
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Proactive follow-ups</h2>
      <p className="text-sm text-black/45">
        GC nudges silent leads automatically. Keep the delay under 24h so messages land inside Meta&apos;s customer-service
        window. Blank = follow-ups off.
      </p>
      <div className="flex items-end gap-3">
        <label className="block text-xs">
          <span className="text-black/45">Follow up after (hours)</span>
          <input
            type="number"
            min={1}
            max={72}
            value={hours ?? ""}
            onChange={(e) => setHours(e.target.value === "" ? null : Number(e.target.value))}
            className={inputClass + " w-32"}
          />
        </label>
        <label className="block text-xs">
          <span className="text-black/45">Max follow-ups</span>
          <input
            type="number"
            min={0}
            max={10}
            value={max}
            onChange={(e) => setMax(Number(e.target.value))}
            className={inputClass + " w-32"}
          />
        </label>
        <SaveButton saved={props.saved} onClick={() => props.onSave({ followUpAfterHours: hours, maxFollowUps: max })} />
      </div>
    </Card>
  );
}

function ChannelsCard(props: { channels: Channel[]; onChanged: () => void }) {
  const [channel, setChannel] = useState("WHATSAPP");
  const [externalId, setExternalId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, externalId, accessToken, displayName: displayName || undefined }),
      });
      if (!res.ok) {
        setError((await res.json()).error || "Failed to connect");
        return;
      }
      setExternalId("");
      setAccessToken("");
      setDisplayName("");
      props.onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(id: string) {
    await fetch("/api/channels", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    props.onChanged();
  }

  const idLabel =
    channel === "WHATSAPP" ? "Phone number ID" : channel === "MESSENGER" ? "Facebook Page ID" : "Instagram Business Account ID";

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold">Meta channels</h2>
        <p className="text-sm text-black/45">
          Connect your WhatsApp Business / Facebook Page / Instagram with your own Meta credentials. Point your Meta
          app&apos;s webhooks at <code className="bg-black/[0.04] px-1 rounded">/api/webhooks/whatsapp</code> and{" "}
          <code className="bg-black/[0.04] px-1 rounded">/api/webhooks/meta</code>. One-click connect (Embedded Signup)
          arrives once the platform&apos;s Meta app is approved.
        </p>
      </div>

      {props.channels.length > 0 && (
        <ul className="space-y-2">
          {props.channels.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-xl bg-black/[0.02] px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{c.channel}</span>{" "}
                <span className="text-black/45">{c.displayName || c.externalId}</span>
                {!c.isActive && <span className="text-red-600 text-xs ml-2">inactive</span>}
              </span>
              <button onClick={() => disconnect(c.id)} className="text-xs text-red-600 hover:underline">
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={connect} className="grid md:grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="text-black/45">Channel</span>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClass}>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="MESSENGER">Facebook Messenger</option>
            <option value="INSTAGRAM">Instagram DM</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-black/45">{idLabel}</span>
          <input required value={externalId} onChange={(e) => setExternalId(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs">
          <span className="text-black/45">Access token (kept server-side, never shown again)</span>
          <input required type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs">
          <span className="text-black/45">Display name (optional)</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
        </label>
        {error && <p className="text-xs text-red-600 md:col-span-2">{error}</p>}
        <div className="md:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Connecting…" : "Connect channel"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
