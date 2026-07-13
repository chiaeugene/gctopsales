"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon } from "@/components/ui/icons";

type Segment = { value: string; label: string };
type Target = {
  orderId: string;
  name: string;
  source: string;
  productInterest: string | null;
  inWindow: boolean;
  channelReady: boolean;
  sendable: boolean;
  message: string;
};

type Template = { id: string; name: string; language: string; status: string; varCount: number; bodyText: string };

const inputCls =
  "mt-1.5 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow";

export default function CampaignsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segment, setSegment] = useState("warm_quiet");
  const [offer, setOffer] = useState("");
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [templateVars, setTemplateVars] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/campaigns");
      if (res.ok) setSegments((await res.json()).segments);
      const tr = await fetch("/api/templates");
      if (tr.ok) setTemplates((await tr.json()).templates.filter((t: Template) => t.status === "APPROVED"));
    })();
  }, []);

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const outOfWindowWa = targets?.filter((t) => t.source === "WHATSAPP" && !t.inWindow) ?? [];

  async function sendTemplate() {
    if (!templateId || outOfWindowWa.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_template", templateId, vars: templateVars, orderIds: outOfWindowWa.map((t) => t.orderId) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Template send failed");
        return;
      }
      setResult(`Sent ${json.sent} template message${json.sent === 1 ? "" : "s"}${json.skipped ? `, skipped ${json.skipped}` : ""}.`);
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    if (!offer.trim()) {
      setError("Describe the campaign / offer first");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", segment, offer }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to build campaign");
        return;
      }
      setTargets(json.targets);
    } finally {
      setBusy(false);
    }
  }

  function updateMsg(orderId: string, message: string) {
    setTargets((cur) => cur?.map((t) => (t.orderId === orderId ? { ...t, message } : t)) ?? null);
  }

  async function send() {
    if (!targets) return;
    const toSend = targets.filter((t) => t.sendable && t.message.trim());
    if (toSend.length === 0) {
      setError("No sendable leads (they must be within the 24h window and on a connected channel).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", messages: toSend.map((t) => ({ orderId: t.orderId, message: t.message })) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Send failed");
        return;
      }
      setResult(`Sent ${json.sent} message${json.sent === 1 ? "" : "s"}${json.skipped ? `, skipped ${json.skipped} (outside window)` : ""}.`);
      setTargets(null);
    } finally {
      setBusy(false);
    }
  }

  const sendableCount = targets?.filter((t) => t.sendable && t.message.trim()).length ?? 0;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Re-engagement campaigns"
        subtitle={
          <>
            Win back past leads with a personalized nudge. GC drafts a unique message for each person based on what they
            cared about — you review and send. Free-form messages can only reach leads active in the last 24h; older ones
            need a WhatsApp-approved template (they&apos;re flagged, not sent).
          </>
        }
      />

      {result && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckIcon className="w-4 h-4 shrink-0" />
          {result}
        </div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <Card>
        <div className="space-y-3">
          <label className="block text-xs">
            <span className="text-black/45">Audience</span>
            <select value={segment} onChange={(e) => setSegment(e.target.value)} className={inputCls}>
              {segments.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-black/45">The campaign / offer (GC personalizes it per lead)</span>
            <textarea
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              rows={2}
              placeholder="e.g. July flash: Total DX+ B3F1 (buy 3 free 1) + free gift this week only"
              className={inputCls}
            />
          </label>
          <Button onClick={preview} disabled={busy}>
            {busy ? "Drafting…" : "Draft messages"}
          </Button>
        </div>
      </Card>

      {targets && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-black/45">{targets.length} lead{targets.length === 1 ? "" : "s"} · {sendableCount} sendable now</div>
            <Button onClick={send} disabled={busy || sendableCount === 0}>
              Send to {sendableCount} sendable
            </Button>
          </div>
          {/* Out-of-window WhatsApp leads → reach via approved template */}
          {outOfWindowWa.length > 0 && (
            <Card className="!bg-amber-50 !border-amber-200">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-amber-900">
                  {outOfWindowWa.length} WhatsApp lead{outOfWindowWa.length === 1 ? "" : "s"} outside the 24h window
                </div>
                <p className="text-xs text-amber-800">
                  These can only be reached with a Meta-approved WhatsApp template. Pick one below (manage them in the{" "}
                  <a href="/templates" className="underline">Templates</a> tab). Use <code>{"{name}"}</code> in a variable to insert the customer&apos;s name.
                </p>
                {templates.length === 0 ? (
                  <p className="text-xs text-amber-700">No approved templates yet — add one in Templates first.</p>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={templateId}
                      onChange={(e) => {
                        setTemplateId(e.target.value);
                        const t = templates.find((x) => x.id === e.target.value);
                        setTemplateVars(t ? Array(t.varCount).fill("").map((_, i) => (i === 0 ? "{name}" : "")) : []);
                      }}
                      className="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow"
                    >
                      <option value="">Choose an approved template…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                      ))}
                    </select>
                    {selectedTemplate && (
                      <>
                        <div className="text-xs text-black/60 bg-white rounded-lg p-2 whitespace-pre-wrap">{selectedTemplate.bodyText}</div>
                        {templateVars.map((v, i) => (
                          <label key={i} className="block text-xs">
                            <span className="text-amber-800">Variable {"{{"}{i + 1}{"}}"}</span>
                            <input
                              value={v}
                              onChange={(e) => setTemplateVars((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
                              className="mt-1.5 w-full rounded-xl border border-amber-300 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow"
                            />
                          </label>
                        ))}
                        <Button onClick={sendTemplate} disabled={busy} className="!bg-amber-600 !text-white hover:!bg-amber-700 !px-4 !py-1.5 !text-xs">
                          Send template to {outOfWindowWa.length} lead{outOfWindowWa.length === 1 ? "" : "s"}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}

          {targets.length === 0 && <p className="text-sm text-black/35">No leads in this audience yet.</p>}
          {targets.map((t) => (
            <Card key={t.orderId}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {t.name} <span className="text-xs text-black/35">· {t.source}{t.productInterest ? ` · ${t.productInterest}` : ""}</span>
                  </div>
                  {t.sendable ? (
                    <Badge tone="success" icon={<CheckIcon className="w-3 h-3" />}>sendable</Badge>
                  ) : (
                    <span title={!t.channelReady ? "No connected channel for this lead" : "Outside 24h window — needs a template"}>
                      <Badge tone="warm">{!t.channelReady ? "no channel" : "outside 24h window"}</Badge>
                    </span>
                  )}
                </div>
                <textarea
                  value={t.message}
                  onChange={(e) => updateMsg(t.orderId, e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-black/10 bg-black/[0.02] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow"
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
