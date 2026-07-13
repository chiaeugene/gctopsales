"use client";

import { useCallback, useEffect, useState } from "react";

type Testimonial = {
  id: string;
  productId: string | null;
  productName: string | null;
  customerName: string | null;
  market: string | null;
  resultText: string;
  rating: number | null;
  isActive: boolean;
};
type Product = { id: string; name: string };

export default function TestimonialsPage() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Testimonial> | null>(null);

  const load = useCallback(async () => {
    const [t, p] = await Promise.all([fetch("/api/testimonials"), fetch("/api/products")]);
    const tj = await t.json();
    const pj = await p.json();
    if (t.ok) setItems(tj.testimonials);
    if (p.ok) setProducts(pj.products.map((x: Product) => ({ id: x.id, name: x.name })));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(d: Partial<Testimonial>) {
    setError(null);
    if (!d.resultText?.trim()) {
      setError("Result text is required");
      return;
    }
    const res = await fetch("/api/testimonials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: d.id,
        productId: d.productId || null,
        customerName: d.customerName || null,
        market: d.market || null,
        resultText: d.resultText,
        rating: d.rating || null,
        isActive: d.isActive ?? true,
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
    if (!confirm("Delete this testimonial?")) return;
    await fetch("/api/testimonials", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await load();
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customer results (social proof)</h1>
          <p className="text-sm text-neutral-500">
            Real results GC cites at the deciding moment. Add genuine customer outcomes — GC uses them naturally when a
            customer hesitates or doubts a product works. Only what you add here is ever used.
          </p>
        </div>
        <button onClick={() => setDraft({ isActive: true })} className="rounded-lg bg-violet-700 text-white px-4 py-2 text-sm font-semibold hover:bg-violet-800">
          + Add result
        </button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-neutral-400">No testimonials yet — add real customer results to give GC proof to close with.</p>}
        {items.map((t) => (
          <div key={t.id} className="rounded-xl bg-white border border-neutral-200 p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm">
                <span className="font-medium">{t.customerName || "A customer"}</span>
                {t.market && <span className="text-xs text-neutral-400"> · {t.market}</span>}
                {t.productName && <span className="text-xs text-violet-600"> · {t.productName}</span>}
                {t.rating && <span className="text-xs text-amber-500"> {"★".repeat(t.rating)}</span>}
                {!t.isActive && <span className="text-xs text-red-500"> · hidden</span>}
              </div>
              <div className="text-sm text-neutral-600">&ldquo;{t.resultText}&rdquo;</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setDraft(t)} className="text-xs text-violet-700 hover:underline">Edit</button>
              <button onClick={() => remove(t.id)} className="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {draft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setDraft(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{draft.id ? "Edit result" : "Add customer result"}</h2>
            <label className="block text-xs">
              <span className="text-neutral-500">The result / quote (required)</span>
              <textarea
                value={draft.resultText ?? ""}
                onChange={(e) => setDraft({ ...draft, resultText: e.target.value })}
                rows={3}
                placeholder="e.g. lost 6kg in her first month and her bloating is gone"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs">
                <span className="text-neutral-500">Customer label</span>
                <input value={draft.customerName ?? ""} onChange={(e) => setDraft({ ...draft, customerName: e.target.value })} placeholder="Jamie L. / a 45-yo mum" className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
              </label>
              <label className="block text-xs">
                <span className="text-neutral-500">Product</span>
                <select value={draft.productId ?? ""} onChange={(e) => setDraft({ ...draft, productId: e.target.value || null })} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm">
                  <option value="">General / brand</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-neutral-500">Market</span>
                <select value={draft.market ?? ""} onChange={(e) => setDraft({ ...draft, market: e.target.value || null })} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm">
                  <option value="">Any</option>
                  <option value="MY">Malaysia</option>
                  <option value="SG">Singapore</option>
                  <option value="BN">Brunei</option>
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-neutral-500">Rating (1-5)</span>
                <input type="number" min={1} max={5} value={draft.rating ?? ""} onChange={(e) => setDraft({ ...draft, rating: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.isActive ?? true} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
              Active (GC can cite this)
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
