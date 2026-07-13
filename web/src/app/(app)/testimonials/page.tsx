"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StarIcon } from "@/components/ui/icons";

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

const inputCls =
  "mt-1.5 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow";

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
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Customer results (social proof)"
        subtitle={
          <>
            Real results GC cites at the deciding moment. Add genuine customer outcomes — GC uses them naturally when a
            customer hesitates or doubts a product works. Only what you add here is ever used.
          </>
        }
        action={<Button onClick={() => setDraft({ isActive: true })}>+ Add result</Button>}
      />
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-black/35">No testimonials yet — add real customer results to give GC proof to close with.</p>}
        {items.map((t) => (
          <Card key={t.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm flex items-center flex-wrap gap-x-1">
                  <span className="font-medium">{t.customerName || "A customer"}</span>
                  {t.market && <span className="text-xs text-black/35"> · {t.market}</span>}
                  {t.productName && <span className="text-xs text-[var(--accent-ink)]"> · {t.productName}</span>}
                  {t.rating && (
                    <span className="inline-flex items-center gap-0.5 text-amber-500 ml-1">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <StarIcon key={i} className="w-3 h-3" />
                      ))}
                    </span>
                  )}
                  {!t.isActive && <Badge tone="danger">hidden</Badge>}
                </div>
                <div className="mt-1 text-sm text-black/60">&ldquo;{t.resultText}&rdquo;</div>
              </div>
              <div className="flex gap-3 shrink-0">
                <button onClick={() => setDraft(t)} className="text-xs text-[var(--accent-ink)] hover:underline">Edit</button>
                <button onClick={() => remove(t.id)} className="text-xs text-red-600 hover:underline">Delete</button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {draft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setDraft(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3 [box-shadow:var(--shadow-lg)]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold tracking-tight">{draft.id ? "Edit result" : "Add customer result"}</h2>
            <label className="block text-xs">
              <span className="text-black/45">The result / quote (required)</span>
              <textarea
                value={draft.resultText ?? ""}
                onChange={(e) => setDraft({ ...draft, resultText: e.target.value })}
                rows={3}
                placeholder="e.g. lost 6kg in her first month and her bloating is gone"
                className={inputCls}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs">
                <span className="text-black/45">Customer label</span>
                <input value={draft.customerName ?? ""} onChange={(e) => setDraft({ ...draft, customerName: e.target.value })} placeholder="Jamie L. / a 45-yo mum" className={inputCls} />
              </label>
              <label className="block text-xs">
                <span className="text-black/45">Product</span>
                <select value={draft.productId ?? ""} onChange={(e) => setDraft({ ...draft, productId: e.target.value || null })} className={inputCls}>
                  <option value="">General / brand</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-black/45">Market</span>
                <select value={draft.market ?? ""} onChange={(e) => setDraft({ ...draft, market: e.target.value || null })} className={inputCls}>
                  <option value="">Any</option>
                  <option value="MY">Malaysia</option>
                  <option value="SG">Singapore</option>
                  <option value="BN">Brunei</option>
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-black/45">Rating (1-5)</span>
                <input type="number" min={1} max={5} value={draft.rating ?? ""} onChange={(e) => setDraft({ ...draft, rating: e.target.value ? Number(e.target.value) : null })} className={inputCls} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm pt-1">
              <input type="checkbox" checked={draft.isActive ?? true} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
              Active (GC can cite this)
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
