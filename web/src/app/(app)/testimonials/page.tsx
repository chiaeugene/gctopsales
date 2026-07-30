"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  photoUrl: string | null;
  productSeries: string | null;
};
type Product = { id: string; name: string; series: string | null };

// Same real MAE product-line photography the catalog uses, so every category
// here has a visual even before the seller uploads their own customer photos.
// Deliberately PRODUCT packshots, never scraped photos of real people.
const SERIES_IMAGE: Record<string, string> = {
  "BCODE+": "/mae/product-bcode.webp",
  "Claríty Skincare": "/mae/product-skincare.webp",
  "Claríty Anti-Aging": "/mae/product-skincare.webp",
  "Healthcare (Total DX+)": "/mae/product-detox.webp",
  "BRB (Mental Wellness)": "/mae/product-brb.webp",
  "Re.WIND Hair": "/mae/product-hair.webp",
};

const UNGROUPED = "General / brand";

function slug(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// A category with fewer than this many live results is thin — GC runs out of
// fresh proof and starts repeating the same story to the same customer.
const TARGET_PER_CATEGORY = 5;

const inputCls =
  "mt-1.5 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow";

export default function TestimonialsPage() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Testimonial> | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [t, p] = await Promise.all([fetch("/api/testimonials"), fetch("/api/products")]);
    const tj = await t.json();
    const pj = await p.json();
    if (t.ok) setItems(tj.testimonials);
    if (p.ok) setProducts(pj.products.map((x: Product) => ({ id: x.id, name: x.name, series: x.series ?? null })));
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

  async function uploadPhoto(file: File) {
    if (!draft?.id) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/testimonials/${draft.id}/photo`, { method: "POST", body: form });
      if (!res.ok) {
        setError((await res.json()).error || "Photo upload failed");
        return;
      }
      const { url } = await res.json();
      setDraft((d) => (d ? { ...d, photoUrl: url } : d));
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    if (!draft?.id) return;
    await fetch(`/api/testimonials/${draft.id}/photo`, { method: "DELETE" });
    setDraft((d) => (d ? { ...d, photoUrl: null } : d));
    await load();
  }

  // Group by product SERIES (the category an agent actually thinks in), not by
  // individual SKU — a BCODE+ story sells any BCODE+ set. Series order follows
  // the catalog so this page reads the same way the Products page does.
  const seriesOrder: string[] = [];
  for (const p of products) {
    const sr = p.series ?? UNGROUPED;
    if (!seriesOrder.includes(sr)) seriesOrder.push(sr);
  }
  const bySeries = new Map<string, Testimonial[]>();
  for (const t of items) {
    const key = t.productSeries ?? (t.productId ? t.productName ?? UNGROUPED : UNGROUPED);
    if (!bySeries.has(key)) bySeries.set(key, []);
    bySeries.get(key)!.push(t);
  }
  const groups = [...bySeries.entries()]
    .map(([series, list]) => ({ series, items: list }))
    .sort((a, b) => {
      // Catalog order first, then anything unexpected, then General last.
      if (a.series === UNGROUPED) return 1;
      if (b.series === UNGROUPED) return -1;
      const ai = seriesOrder.indexOf(a.series);
      const bi = seriesOrder.indexOf(b.series);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Customer results (social proof)"
        subtitle={
          <>
            Real results GC cites at the deciding moment. Add a genuine quote and, where you have one, a before/after
            photo — GC decides on her own when it fits to send it, the way a top seller would. Only what you add here
            is ever used.
          </>
        }
        action={<Button onClick={() => setDraft({ isActive: true })}>+ Add result</Button>}
      />
      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* Coverage strip — the whole point of grouping: an agent can see at a
          glance which product they have no proof for. */}
      {groups.length > 0 && (
        <Card className="!py-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {groups.map((g) => {
              const live = g.items.filter((x) => x.isActive).length;
              const thin = live < TARGET_PER_CATEGORY;
              return (
                <a
                  key={g.series}
                  href={`#cat-${slug(g.series)}`}
                  className="text-xs inline-flex items-center gap-1.5 hover:underline"
                >
                  <span className={thin ? "text-amber-600" : "text-black/55"}>{g.series}</span>
                  <span
                    className={
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums " +
                      (thin ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")
                    }
                  >
                    {live}
                  </span>
                </a>
              );
            })}
          </div>
        </Card>
      )}

      <div className="space-y-6">
        {items.length === 0 && (
          <p className="text-sm text-black/35">
            No results yet — add real customer results to give GC proof to close with.
          </p>
        )}

        {groups.map((g) => {
          const live = g.items.filter((x) => x.isActive).length;
          const img = SERIES_IMAGE[g.series];
          return (
            <section key={g.series} id={`cat-${slug(g.series)}`} className="space-y-2 scroll-mt-4">
              <div className="flex items-center gap-3">
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover shrink-0 border border-black/[0.06] bg-white"
                  />
                )}
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold tracking-tight truncate">{g.series}</h2>
                  <p className="text-xs text-black/40">
                    {live} live {live === 1 ? "result" : "results"}
                    {live < TARGET_PER_CATEGORY && (
                      <span className="text-amber-600"> · thin, aim for {TARGET_PER_CATEGORY}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {g.items.map((t) => (
                  <Card key={t.id}>
                    <div className="flex items-start justify-between gap-3">
                      {t.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.photoUrl}
                          alt=""
                          className="w-14 h-14 rounded-xl object-cover shrink-0 border border-black/[0.06]"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm flex items-center flex-wrap gap-x-1">
                          <span className="font-medium">{t.customerName || "A customer"}</span>
                          {t.market && <span className="text-xs text-black/35"> · {t.market}</span>}
                          {t.productName && (
                            <span className="text-xs text-[var(--accent-ink)]"> · {t.productName}</span>
                          )}
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
                        <button
                          onClick={() => setDraft(t)}
                          className="text-xs text-[var(--accent-ink)] hover:underline"
                        >
                          Edit
                        </button>
                        <button onClick={() => remove(t.id)} className="text-xs text-red-600 hover:underline">
                          Delete
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
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

            {/* Before/after photo — quote and picture live together; GC decides
                on her own when to send it, no manual dispatch needed. */}
            <div className="border-t border-black/[0.06] pt-3 space-y-2">
              <div className="text-sm font-semibold">Before/after photo</div>
              {!draft.id && <p className="text-xs text-black/45">Save this result first, then reopen it to add a photo.</p>}
              {draft.id && (
                <div className="flex items-center gap-3">
                  {draft.photoUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={draft.photoUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-black/[0.06]" />
                      <button onClick={removePhoto} className="text-xs text-red-600 hover:underline">Remove photo</button>
                    </>
                  ) : (
                    <>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadPhoto(f);
                          e.target.value = "";
                        }}
                      />
                      <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        {uploading ? "Uploading…" : "Upload photo"}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

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
