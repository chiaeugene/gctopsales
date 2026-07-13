"use client";

import { useCallback, useEffect, useState } from "react";

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
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp templates</h1>
          <p className="text-sm text-neutral-500">
            Templates are the only way to message a customer after the 24-hour window closes — so re-engagement campaigns
            use them for cold leads. Create the template in your Meta WhatsApp Manager, get it approved, then mirror it
            here (same name, language, and body) so GC can send it.
          </p>
        </div>
        <button onClick={() => setDraft({ language: "en", category: "MARKETING", status: "PENDING" })} className="rounded-lg bg-violet-700 text-white px-4 py-2 text-sm font-semibold hover:bg-violet-800">
          + Add template
        </button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-neutral-400">No templates yet. Add your Meta-approved templates here to reach cold leads.</p>}
        {items.map((t) => (
          <div key={t.id} className="rounded-xl bg-white border border-neutral-200 p-4 space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {t.name} <span className="text-xs text-neutral-400">· {t.language} · {t.category} · {t.varCount} var{t.varCount === 1 ? "" : "s"}</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={t.status} />
                <button onClick={() => setDraft(t)} className="text-xs text-violet-700 hover:underline">Edit</button>
                <button onClick={() => remove(t.id)} className="text-xs text-red-600 hover:underline">Delete</button>
              </div>
            </div>
            <div className="text-sm text-neutral-600 whitespace-pre-wrap bg-neutral-50 rounded-lg p-2">{t.bodyText}</div>
            {t.variableHint && <div className="text-xs text-neutral-400">Variables: {t.variableHint}</div>}
          </div>
        ))}
      </div>

      {draft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setDraft(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{draft.id ? "Edit template" : "Add template"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs">
                <span className="text-neutral-500">Name (exact Meta name)</span>
                <input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="julypromo_dx" className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
              </label>
              <label className="block text-xs">
                <span className="text-neutral-500">Language code</span>
                <input value={draft.language ?? "en"} onChange={(e) => setDraft({ ...draft, language: e.target.value })} placeholder="en / zh_CN / ms" className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
              </label>
              <label className="block text-xs">
                <span className="text-neutral-500">Category</span>
                <select value={draft.category ?? "MARKETING"} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm">
                  <option>MARKETING</option>
                  <option>UTILITY</option>
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-neutral-500">Meta approval status</span>
                <select value={draft.status ?? "PENDING"} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm">
                  <option>PENDING</option>
                  <option>APPROVED</option>
                  <option>REJECTED</option>
                </select>
              </label>
            </div>
            <label className="block text-xs">
              <span className="text-neutral-500">Body (use {"{{1}}"}, {"{{2}}"} for variables — must match Meta exactly)</span>
              <textarea value={draft.bodyText ?? ""} onChange={(e) => setDraft({ ...draft, bodyText: e.target.value })} rows={4} placeholder="Hi {{1}}! Our July promo is on: {{2}}. Reply to grab it 😊" className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="block text-xs">
              <span className="text-neutral-500">Variable hint (optional)</span>
              <input value={draft.variableHint ?? ""} onChange={(e) => setDraft({ ...draft, variableHint: e.target.value })} placeholder="1 = customer name, 2 = the offer" className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDraft(null)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">Cancel</button>
              <button onClick={() => save(draft)} className="rounded-lg bg-violet-700 text-white px-4 py-2 text-sm font-semibold hover:bg-violet-800">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{status}</span>;
}
