"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AlertIcon, CheckIcon } from "@/components/ui/icons";
import { useT } from "@/components/I18nProvider";

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

type Field = { key: string; label: string; help?: string; example?: string };

// Every field below feeds GC's brain directly — labels/help are agent-friendly,
// but the keys are unchanged so nothing in the engine breaks.
// title/why/label/help hold i18n dictionary keys, translated with t() at render.
const BRAIN_SECTIONS: {
  id: keyof Pick<Settings, "identityBrain" | "salesBrain" | "fulfillmentBrain" | "catalogRules">;
  title: string;
  why: string;
  important?: boolean;
  fields: Field[];
}[] = [
  {
    id: "fulfillmentBrain",
    title: "settings.section.fulfillment.title",
    why: "settings.section.fulfillment.why",
    important: true,
    fields: [
      {
        key: "paymentMethods",
        label: "settings.field.paymentMethods.label",
        help: "settings.field.paymentMethods.help",
        example: "Maybank 1234567890 (CHIA EU GENE), Touch 'n Go 012-3456789",
      },
      {
        key: "paymentInstructions",
        label: "settings.field.paymentInstructions.label",
        example: "Transfer to Maybank 1234567890, then send me the receipt screenshot ya!",
      },
      { key: "codRules", label: "settings.field.codRules.label", example: "COD only in Klang Valley, order RM200+" },
      { key: "shippingPolicy", label: "settings.field.shippingPolicy.label", example: "J&T from KL, ship within 1-2 working days" },
      { key: "shippingFeeRules", label: "settings.field.shippingFeeRules.label", example: "Free WM shipping above RM150, otherwise RM10. EM RM15." },
      { key: "deliveryTimeline", label: "settings.field.deliveryTimeline.label", example: "WM 2-3 days, EM 4-6 days, SG about a week" },
      { key: "returnRefundPolicy", label: "settings.field.returnRefundPolicy.label", example: "Unopened products within 7 days; no refund once opened" },
      {
        key: "humanOnlyTopics",
        label: "settings.field.humanOnlyTopics.label",
        help: "settings.field.humanOnlyTopics.help",
        example: "Bulk/agent pricing, complaints about a previous order",
      },
    ],
  },
  {
    id: "identityBrain",
    title: "settings.section.identity.title",
    why: "settings.section.identity.why",
    fields: [
      { key: "storeName", label: "settings.field.storeName.label", example: "GC Wellness by Eugene" },
      { key: "targetCustomer", label: "settings.field.targetCustomer.label", example: "Working mums 30-50, weight & energy goals" },
      { key: "brandPersonality", label: "settings.field.brandPersonality.label", example: "Like a knowledgeable big sister — caring but straight-talking" },
      { key: "toneOfVoice", label: "settings.field.toneOfVoice.label", example: "Warm, uses 'dear', short messages, some emoji" },
      { key: "languageStyle", label: "settings.field.languageStyle.label", example: "Mostly Mandarin + English mix, some Malay" },
      { key: "differentiators", label: "settings.field.differentiators.label", example: "I follow up personally, fast delivery, I use the products myself" },
      { key: "offerings", label: "settings.field.offerings.label", example: "Full MAE range, focus on BCODE+ weight management" },
    ],
  },
  {
    id: "salesBrain",
    title: "settings.section.sales.title",
    why: "settings.section.sales.why",
    fields: [
      {
        key: "discountRules",
        label: "settings.field.discountRules.label",
        help: "settings.field.discountRules.help",
        example: "No discounts beyond member price. Free gift for 2+ sets.",
      },
      { key: "followUpRules", label: "settings.field.followUpRules.label", example: "Gentle check-in after 1 day, max twice, never pushy" },
      { key: "objectionStyle", label: "settings.field.objectionStyle.label", example: "Break into per-day cost, share a similar customer's result" },
      { key: "conversationStrategy", label: "settings.field.conversationStrategy.label", example: "Ask about their goal + what they've tried before recommending" },
      { key: "upsellStrategy", label: "settings.field.upsellStrategy.label", example: "After they commit: upgrade single box to 2-box bundle for free gift" },
      { key: "allowedToSay", label: "settings.field.allowedToSay.label", example: "I'm an authorized MAE agent; products are NPRA-notified & halal" },
      { key: "neverSay", label: "settings.field.neverSay.label", example: "Never guarantee weight-loss numbers, never mention my supplier price" },
      { key: "salesPressure", label: "settings.field.salesPressure.label", example: "balanced" },
    ],
  },
  {
    id: "catalogRules",
    title: "settings.section.catalog.title",
    why: "settings.section.catalog.why",
    fields: [
      {
        key: "currentPromotions",
        label: "settings.field.currentPromotions.label",
        help: "settings.field.currentPromotions.help",
        example: "July: buy 2 boxes B-ActV free 1 shaker, ends 31/7",
      },
      { key: "bundleRules", label: "settings.field.bundleRules.label", example: "SET2BC = 2 boxes B-ActV + 1 CactiGold" },
      { key: "membershipPitch", label: "settings.field.membershipPitch.label", example: "One-time RM30 membership unlocks ~20% member price forever" },
      { key: "loyaltyProgram", label: "settings.field.loyaltyProgram.label", example: "Every 5th box free shaker; birthday month 5% off" },
      { key: "authenticityGuarantee", label: "settings.field.authenticityGuarantee.label", example: "Sealed MAE boxes with QR verification, I'm a registered agent" },
      { key: "complianceRules", label: "settings.field.complianceRules.label", example: "Never call it 'slimming medicine'; always food supplement" },
    ],
  },
];

const inputClass =
  "mt-1.5 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow";

export default function SettingsPage() {
  const { t } = useT();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCard, setSavedCard] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/settings");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || t("settings.loadFailed"));
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
      setError((await res.json()).error || t("settings.saveFailed"));
      return;
    }
    setSavedCard(card);
    setTimeout(() => setSavedCard(null), 2000);
  }

  if (!settings) return <div className="text-sm text-black/40">{error || t("settings.loading")}</div>;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      {error && <div className="text-sm text-red-600">{error}</div>}

      <MarketsCard
        homeMarket={settings.homeMarket}
        marketsServed={settings.marketsServed}
        saved={savedCard === "markets"}
        onSave={(v) => save("markets", v)}
      />

      <ToneCard tone={settings.tone} saved={savedCard === "tone"} onSave={(v) => save("tone", { tone: v })} />

      {BRAIN_SECTIONS.map((sec) => (
        <BrainCard
          key={sec.id}
          title={sec.title}
          why={sec.why}
          important={sec.important}
          fields={sec.fields}
          values={settings[sec.id]}
          saved={savedCard === sec.id}
          onSave={(values) => save(sec.id, { [sec.id]: values })}
        />
      ))}

      <FollowUpCard
        followUpAfterHours={settings.followUpAfterHours}
        maxFollowUps={settings.maxFollowUps}
        saved={savedCard === "followups"}
        onSave={(v) => save("followups", v)}
      />

      <ChannelsCard channels={settings.channels} onChanged={load} />

      <Card className="!border-amber-200 !bg-amber-50 space-y-3">
        <h2 className="font-semibold text-amber-900 flex items-center gap-2">
          <AlertIcon className="w-4 h-4 shrink-0" />
          {t("settings.autoconfirm.title")}
        </h2>
        <p className="text-sm text-amber-800">{t("settings.autoconfirm.desc")}</p>
        <label className="flex items-center gap-2 text-sm font-medium text-amber-900">
          <input
            type="checkbox"
            checked={settings.autoConfirmPayments}
            onChange={(e) => {
              setSettings({ ...settings, autoConfirmPayments: e.target.checked });
              save("autoconfirm", { autoConfirmPayments: e.target.checked });
            }}
          />
          {t("settings.autoconfirm.enable")}
          {savedCard === "autoconfirm" && (
            <span className="inline-flex items-center gap-1 text-emerald-700 text-xs">
              <CheckIcon className="w-3.5 h-3.5" /> {t("settings.saved")}
            </span>
          )}
        </label>
      </Card>
    </div>
  );
}

// Values are i18n dictionary keys — translated with t() at render.
const MARKET_LABELS: Record<string, string> = {
  MY: "settings.market.MY",
  SG: "settings.market.SG",
  BN: "settings.market.BN",
};

const TONE_OPTIONS = [
  { value: "professional", label: "settings.tone.professional.label", desc: "settings.tone.professional.desc" },
  { value: "balanced", label: "settings.tone.balanced.label", desc: "settings.tone.balanced.desc" },
  { value: "local", label: "settings.tone.local.label", desc: "settings.tone.local.desc" },
];

function SaveButton({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  const { t } = useT();
  return (
    <Button variant="secondary" onClick={onClick} className="!px-4 !py-1.5 !text-xs">
      {saved ? (
        <span className="inline-flex items-center gap-1">
          <CheckIcon className="w-3.5 h-3.5" /> {t("settings.saved")}
        </span>
      ) : (
        t("settings.save")
      )}
    </Button>
  );
}

function ToneCard(props: { tone: string; saved: boolean; onSave: (v: string) => void }) {
  const { t } = useT();
  const [tone, setTone] = useState(props.tone);
  useEffect(() => setTone(props.tone), [props.tone]);
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">{t("settings.tone.title")}</h2>
      <p className="text-sm text-black/45">{t("settings.tone.desc")}</p>
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
              <span className="text-sm font-medium">{t(o.label)}</span>
              <span className="block text-xs text-black/45">{t(o.desc)}</span>
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
  const { t } = useT();
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
      <h2 className="font-semibold">{t("settings.markets.title")}</h2>
      <p className="text-sm text-black/45">{t("settings.markets.desc")}</p>
      <div className="flex flex-wrap gap-4">
        {["MY", "SG", "BN"].map((m) => (
          <label key={m} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={served.includes(m)} onChange={() => toggle(m)} />
            {t(MARKET_LABELS[m])}
          </label>
        ))}
      </div>
      <label className="block text-xs">
        <span className="text-black/45">{t("settings.markets.home")}</span>
        <select value={home} onChange={(e) => setHome(e.target.value)} className={inputClass + " w-56"}>
          {["MY", "SG", "BN"].map((m) => (
            <option key={m} value={m}>
              {t(MARKET_LABELS[m])}
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
  why: string;
  important?: boolean;
  fields: Field[];
  values: Record<string, string>;
  saved: boolean;
  onSave: (values: Record<string, string>) => void;
}) {
  const { t } = useT();
  const [values, setValues] = useState(props.values);
  const [open, setOpen] = useState(Boolean(props.important));
  useEffect(() => setValues(props.values), [props.values]);

  const filled = props.fields.filter((f) => (values[f.key] ?? "").trim()).length;

  return (
    <Card className="space-y-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold flex items-center gap-2">
            {t(props.title)}
            {props.important && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--accent-ink)] bg-[var(--accent-soft)] rounded-full px-2 py-0.5">
                {t("settings.important")}
              </span>
            )}
          </h2>
          <span className="text-xs text-black/40 shrink-0">
            {filled}/{props.fields.length} {t("settings.filled")} {open ? "▴" : "▾"}
          </span>
        </div>
        <p className="text-sm text-black/45 mt-0.5">{t(props.why)}</p>
      </button>

      {open && (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            {props.fields.map((f) => (
              <label key={f.key} className="block text-xs">
                <span className="font-medium text-black/70">{t(f.label)}</span>
                {f.help && <span className="block text-black/40 mt-0.5">{t(f.help)}</span>}
                <textarea
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  rows={3}
                  placeholder={f.example ? `${t("settings.eg")} ${f.example}` : undefined}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
          <SaveButton saved={props.saved} onClick={() => props.onSave(values)} />
        </>
      )}
    </Card>
  );
}

function FollowUpCard(props: {
  followUpAfterHours: number | null;
  maxFollowUps: number;
  saved: boolean;
  onSave: (v: { followUpAfterHours: number | null; maxFollowUps: number }) => void;
}) {
  const { t } = useT();
  const [hours, setHours] = useState(props.followUpAfterHours);
  const [max, setMax] = useState(props.maxFollowUps);
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">{t("settings.followups.title")}</h2>
      <p className="text-sm text-black/45">{t("settings.followups.desc")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs">
          <span className="text-black/45">{t("settings.followups.after")}</span>
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
          <span className="text-black/45">{t("settings.followups.max")}</span>
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
  const { t } = useT();
  const [open, setOpen] = useState(false);
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
        setError((await res.json()).error || t("settings.channels.connectFailed"));
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
    channel === "WHATSAPP"
      ? t("settings.channels.idWhatsapp")
      : channel === "MESSENGER"
        ? t("settings.channels.idMessenger")
        : t("settings.channels.idInstagram");

  return (
    <Card className="space-y-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{t("settings.channels.title")}</h2>
          <span className="text-xs text-black/40">{open ? "▴" : "▾"}</span>
        </div>
        <p className="text-sm text-black/45 mt-0.5">{t("settings.channels.desc")}</p>
      </button>

      {open && (
        <>
          {props.channels.length > 0 && (
            <ul className="space-y-2">
              {props.channels.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-xl bg-black/[0.02] px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{c.channel}</span>{" "}
                    <span className="text-black/45">{c.displayName || c.externalId}</span>
                    {!c.isActive && <span className="text-red-600 text-xs ml-2">{t("settings.channels.inactive")}</span>}
                  </span>
                  <button onClick={() => disconnect(c.id)} className="text-xs text-red-600 hover:underline">
                    {t("settings.channels.disconnect")}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={connect} className="grid md:grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="text-black/45">{t("settings.channels.channel")}</span>
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
              <span className="text-black/45">{t("settings.channels.accessToken")}</span>
              <input required type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-xs">
              <span className="text-black/45">{t("settings.channels.displayName")}</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
            </label>
            {error && <p className="text-xs text-red-600 md:col-span-2">{error}</p>}
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? t("settings.channels.connecting") : t("settings.channels.connect")}
              </Button>
            </div>
          </form>
        </>
      )}
    </Card>
  );
}
