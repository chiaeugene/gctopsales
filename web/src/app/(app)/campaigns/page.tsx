"use client";

import { useEffect, useState } from "react";

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
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Re-engagement campaigns</h1>
        <p className="text-sm text-neutral-500">
          Win back past leads with a personalized nudge. GC drafts a unique message for each person based on what they
          cared about — you review and send. Free-form messages can only reach leads active in the last 24h; older ones
          need a WhatsApp-approved template (they&apos;re flagged, not sent).
        </p>
      </div>

      {result && <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">✅ {result}</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="rounded-xl bg-white border border-neutral-200 p-5 space-y-3">
        <label className="block text-xs">
          <span className="text-neutral-500">Audience</span>
          <select value={segment} onChange={(e) => setSegment(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm">
            {segments.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-neutral-500">The campaign / offer (GC personalizes it per lead)</span>
          <textarea
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            rows={2}
            placeholder="e.g. July flash: Total DX+ B3F1 (buy 3 free 1) + free gift this week only"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button onClick={preview} disabled={busy} className="rounded-lg bg-violet-700 text-white px-4 py-2 text-sm font-semibold hover:bg-violet-800 disabled:opacity-50">
          {busy ? "Drafting…" : "Draft messages"}
        </button>
      </div>

      {targets && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-neutral-500">{targets.length} lead{targets.length === 1 ? "" : "s"} · {sendableCount} sendable now</div>
            <button onClick={send} disabled={busy || sendableCount === 0} className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
              Send to {sendableCount} sendable
            </button>
          </div>
          {/* Out-of-window WhatsApp leads → reach via approved template */}
          {outOfWindowWa.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
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
                    className="w-full rounded-lg border border-amber-300 px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="">Choose an approved template…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                    ))}
                  </select>
                  {selectedTemplate && (
                    <>
                      <div className="text-xs text-neutral-600 bg-white rounded-lg p-2 whitespace-pre-wrap">{selectedTemplate.bodyText}</div>
                      {templateVars.map((v, i) => (
                        <label key={i} className="block text-xs">
                          <span className="text-amber-800">Variable {"{{"}{i + 1}{"}}"}</span>
                          <input value={v} onChange={(e) => setTemplateVars((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))} className="mt-1 w-full rounded-lg border border-amber-300 px-2 py-1.5 text-sm" />
                        </label>
                      ))}
                      <button onClick={sendTemplate} disabled={busy} className="rounded-lg bg-amber-600 text-white px-4 py-2 text-xs font-semibold hover:bg-amber-700 disabled:opacity-50">
                        Send template to {outOfWindowWa.length} lead{outOfWindowWa.length === 1 ? "" : "s"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {targets.length === 0 && <p className="text-sm text-neutral-400">No leads in this audience yet.</p>}
          {targets.map((t) => (
            <div key={t.orderId} className="rounded-xl bg-white border border-neutral-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {t.name} <span className="text-xs text-neutral-400">· {t.source}{t.productInterest ? ` · ${t.productInterest}` : ""}</span>
                </div>
                {t.sendable ? (
                  <span className="text-xs text-emerald-600 font-medium">✓ sendable</span>
                ) : (
                  <span className="text-xs text-amber-600" title={!t.channelReady ? "No connected channel for this lead" : "Outside 24h window — needs a template"}>
                    {!t.channelReady ? "no channel" : "outside 24h window"}
                  </span>
                )}
              </div>
              <textarea
                value={t.message}
                onChange={(e) => updateMsg(t.orderId, e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm bg-neutral-50"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
