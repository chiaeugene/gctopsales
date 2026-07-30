"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type Template = {
  id: string;
  name: string;
  language: string;
  category: string;
  bodyText: string;
  variableHint: string | null;
  status: string;
  varCount: number;
};

const inputCls =
  "mt-1.5 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow";

export default function TemplatesPage() {
  const [items, setItems] = useState<Template[]>([]);
  const [draft, setDraft] = useState<Partial<Template> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/templates");
    if (res.ok) setItems((await res.json()).templates);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(d: Partial<Template>) {
    setError(null);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: d.id,
        name: d.name,
        language: d.language || "en",
        category: d.category || "MARKETING",
        bodyText: d.bodyText,
        variableHint: d.variableHint || null,
        // Status is never chosen by a human — it comes from Meta via
        // Submit to WhatsApp / Refresh statuses.
        status: d.status || "PENDING",
      }),
    });
    if (!res.ok) {
      setError((await res.json()).error || "Save failed");
      return;
    }
    setDraft(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    await fetch("/api/templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await load();
  }

  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Pull real approval statuses from Meta (the only source of truth) and
  // import any templates that exist on the WhatsApp account but not here.
  async function syncStatuses() {
    setSyncing(true);
    setSubmitMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/templates/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not read statuses from WhatsApp");
        return;
      }
      setSubmitMsg(
        `Checked ${json.checked} template${json.checked === 1 ? "" : "s"} on WhatsApp · ${json.updated} status update${json.updated === 1 ? "" : "s"}${json.imported ? `, ${json.imported} imported` : ""}.`
      );
      await load();
    } finally {
      setSyncing(false);
    }
  }

  // Sends the template to Meta for approval on the agent's own WhatsApp
  // Business Account (whatsapp_business_management).
  async function submitToMeta(t: Template) {
    setSubmitting(t.id);
    setSubmitMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/templates/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Meta rejected the template");
        return;
      }
      setSubmitMsg(
        `"${t.name}" submitted to WhatsApp · status ${json.status}. Meta usually reviews within minutes to a few hours.`
      );
      await load();
    } finally {
      setSubmitting(null);
    }
  }

  const [generating, setGenerating] = useState(false);
  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/templates", { method: "PUT" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "GC could not draft templates");
        return;
      }
      await load();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Message library"
        subtitle={
          <>
            Ready-to-send messages for the moments every seller repeats: re-introductions, payment reminders, shipping
            updates, reorder nudges, promo blasts. Copy any of them into WhatsApp today. When WhatsApp connects, these
            same templates get submitted to Meta and GC sends them automatically to cold leads.
          </>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={syncStatuses} disabled={syncing}>
              {syncing ? "Checking…" : "Refresh statuses"}
            </Button>
            <Button onClick={() => setDraft({ language: "en", category: "MARKETING", status: "PENDING" })}>
              + Add template
            </Button>
          </div>
        }
      />
      {error && <div className="text-sm text-red-600">{error}</div>}
      {submitMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{submitMsg}</div>
      )}

      {/* GC drafts the starter library from this agent's own brains */}
      <Card className="!border-[var(--accent)]/25 !bg-[var(--accent-soft)]/40 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Let GC write your starter set</h2>
          <p className="text-sm text-black/50 mt-0.5 max-w-md">
            One click and GC drafts 5 practical templates in your store&apos;s voice, using your real shipping and payment
            rules. Edit anything after.
          </p>
        </div>
        <Button onClick={generate} disabled={generating} className="shrink-0">
          {generating ? "Drafting…" : "Draft 5 templates"}
        </Button>
      </Card>

      <div className="flex items-center gap-2 text-xs text-black/40">
        <span className="text-[10px] font-bold uppercase tracking-wide text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">
          Releasing soon
        </span>
        Auto-sending templates through WhatsApp unlocks when channels connect. Until then, use Copy.
      </div>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-black/35">No templates yet. Add your Meta-approved templates here to reach cold leads.</p>}
        {items.map((t) => (
          <Card key={t.id}>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {t.name} <span className="text-xs text-black/35">· {t.language} · {t.category} · {t.varCount} var{t.varCount === 1 ? "" : "s"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={t.status} />
                  <button
                    onClick={() => submitToMeta(t)}
                    disabled={submitting === t.id}
                    className="text-xs font-medium text-[var(--accent-ink)] hover:underline disabled:opacity-40"
                    title="Create this template on your WhatsApp Business Account for Meta approval"
                  >
                    {submitting === t.id ? "Submitting…" : "Submit to WhatsApp"}
                  </button>
                  <button onClick={() => setDraft(t)} className="text-xs text-[var(--accent-ink)] hover:underline">Edit</button>
                  <button onClick={() => remove(t.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                </div>
              </div>
              <div className="text-sm text-black/60 whitespace-pre-wrap bg-black/[0.02] rounded-lg p-2">{t.bodyText}</div>
              {t.variableHint && <div className="text-xs text-black/35">Variables: {t.variableHint}</div>}
              <CopyTemplateButton text={t.bodyText} />
            </div>
          </Card>
        ))}
      </div>

      {draft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setDraft(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3 [box-shadow:var(--shadow-lg)]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold tracking-tight">{draft.id ? "Edit template" : "Add template"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs">
                <span className="text-black/45">Name (exact Meta name)</span>
                <input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="julypromo_dx" className={inputCls} />
              </label>
              <label className="block text-xs">
                <span className="text-black/45">Language code</span>
                <input value={draft.language ?? "en"} onChange={(e) => setDraft({ ...draft, language: e.target.value })} placeholder="en / zh_CN / ms" className={inputCls} />
              </label>
              <label className="block text-xs">
                <span className="text-black/45">Category</span>
                <select value={draft.category ?? "MARKETING"} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={inputCls}>
                  <option>MARKETING</option>
                  <option>UTILITY</option>
                </select>
              </label>
              <div className="block text-xs">
                <span className="text-black/45">Approval status</span>
                <div className="mt-1.5 rounded-xl border border-black/10 bg-black/[0.03] px-3.5 py-2.5 text-sm text-black/50">
                  {draft.status ?? "PENDING"}
                  <span className="block text-[11px] text-black/35">Set by WhatsApp, not editable</span>
                </div>
              </div>
            </div>
            <label className="block text-xs">
              <span className="text-black/45">Body (use {"{{1}}"}, {"{{2}}"} for variables)</span>
              <textarea value={draft.bodyText ?? ""} onChange={(e) => setDraft({ ...draft, bodyText: e.target.value })} rows={4} placeholder="Hi {{1}}! Our July promo is on: {{2}}. Reply to grab it." className={inputCls} />
            </label>
            <label className="block text-xs">
              <span className="text-black/45">Variable hint (optional)</span>
              <input value={draft.variableHint ?? ""} onChange={(e) => setDraft({ ...draft, variableHint: e.target.value })} placeholder="1 = customer name, 2 = the offer" className={inputCls} />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
              <Button onClick={() => save(draft)}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = (status === "APPROVED" ? "success" : status === "REJECTED" ? "danger" : "warm") as "success" | "danger" | "warm";
  return <Badge tone={tone}>{status}</Badge>;
}

// Manual mode: copy the template body (with {{n}} slots filled by hand) until
// WhatsApp auto-send unlocks.
function CopyTemplateButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-ink)] hover:underline"
    >
      {copied ? "Copied, fill in the blanks and send" : "Copy message"}
    </button>
  );
}
