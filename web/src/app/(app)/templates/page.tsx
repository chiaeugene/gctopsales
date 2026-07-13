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

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="WhatsApp templates"
        subtitle={
          <>
            Templates are the only way to message a customer after the 24-hour window closes — so re-engagement campaigns
            use them for cold leads. Create the template in your Meta WhatsApp Manager, get it approved, then mirror it
            here (same name, language, and body) so GC can send it.
          </>
        }
        action={<Button onClick={() => setDraft({ language: "en", category: "MARKETING", status: "PENDING" })}>+ Add template</Button>}
      />
      {error && <div className="text-sm text-red-600">{error}</div>}

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
                  <button onClick={() => setDraft(t)} className="text-xs text-[var(--accent-ink)] hover:underline">Edit</button>
                  <button onClick={() => remove(t.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                </div>
              </div>
              <div className="text-sm text-black/60 whitespace-pre-wrap bg-black/[0.02] rounded-lg p-2">{t.bodyText}</div>
              {t.variableHint && <div className="text-xs text-black/35">Variables: {t.variableHint}</div>}
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
              <label className="block text-xs">
                <span className="text-black/45">Meta approval status</span>
                <select value={draft.status ?? "PENDING"} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className={inputCls}>
                  <option>PENDING</option>
                  <option>APPROVED</option>
                  <option>REJECTED</option>
                </select>
              </label>
            </div>
            <label className="block text-xs">
              <span className="text-black/45">Body (use {"{{1}}"}, {"{{2}}"} for variables — must match Meta exactly)</span>
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
