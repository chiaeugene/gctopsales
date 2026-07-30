"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type Link = {
  id: string;
  label: string;
  url: string;
  kind: string;
  note: string | null;
  productId: string | null;
  isActive: boolean;
};
type Product = { id: string; name: string };

const KINDS: { value: string; label: string; hint: string }[] = [
  { value: "PRODUCT", label: "Official product page", hint: "Proves the product and the brand are real" },
  { value: "REVIEW", label: "Review / testimonial post", hint: "Third-party proof from a real buyer" },
  { value: "CERT", label: "Certification / lab report", hint: "Halal, NPRA, GMP, SGS — answers the safety question" },
  { value: "CATALOG", label: "Catalogue / price list", hint: "For a customer who wants to browse everything" },
  { value: "VIDEO", label: "Video", hint: "Demo, unboxing, founder story" },
  { value: "SHOP", label: "Shop listing", hint: "Shopee / Lazada / official store" },
  { value: "OTHER", label: "Other", hint: "" },
];

const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

const inputCls =
  "mt-1.5 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow";

const BLANK: Partial<Link> = { kind: "PRODUCT", isActive: true };

export default function LinksPage() {
  const [links, setLinks] = useState<Link[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<Partial<Link> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/links");
    const json = await res.json();
    if (res.ok) {
      setLinks(json.links);
      setProducts(json.products);
    } else setError(json.error || "Could not load your links");
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(d: Partial<Link>) {
    setError(null);
    if (!d.label?.trim() || !d.url?.trim()) {
      setError("A link needs a name and a URL.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: d.id,
          label: d.label,
          url: d.url,
          kind: d.kind ?? "OTHER",
          note: d.note || null,
          productId: d.productId || null,
          isActive: d.isActive ?? true,
        }),
      });
      if (!res.ok) {
        setError((await res.json()).error || "Save failed");
        return;
      }
      setDraft(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this link?")) return;
    await fetch("/api/links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <PageHeader
        title="Links GC can send"
        subtitle="Someone about to transfer RM500 to a stranger wants to check you're real. A link to the official page, a certificate or a review does that in one tap. GC only ever sends links you add here."
        action={<Button onClick={() => setDraft({ ...BLANK })}>+ Add link</Button>}
      />
      {error && <div className="text-sm text-red-600">{error}</div>}

      {links.length === 0 && (
        <Card className="space-y-2">
          <h2 className="font-semibold text-sm">Worth adding first</h2>
          <ul className="text-sm text-black/55 space-y-1">
            <li>· The official MAE product page for your best sellers</li>
            <li>· Your halal / NPRA certification page or PDF</li>
            <li>· One review or before-after post from a real customer</li>
            <li>· Your own shop listing, if you have one</li>
          </ul>
          <p className="text-xs text-black/40">
            Add a note on each one saying when it helps, e.g. &ldquo;send when they ask if it&rsquo;s safe&rdquo;. GC
            uses that note to pick the right moment instead of spamming links.
          </p>
        </Card>
      )}

      <div className="space-y-1.5">
        {links.map((l) => (
          <div key={l.id} className="group/row rounded-2xl border border-black/[0.07] bg-white px-3.5 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{l.label}</span>
                  <Badge>{KIND_LABEL[l.kind] ?? l.kind}</Badge>
                  {!l.isActive && <Badge tone="danger">off</Badge>}
                </div>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-[var(--accent-ink)] hover:underline truncate mt-0.5"
                >
                  {l.url}
                </a>
                {l.note && <p className="mt-1 text-xs text-black/45">When: {l.note}</p>}
              </div>
              <div className="flex gap-2.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 transition-opacity">
                <button onClick={() => setDraft(l)} className="text-xs text-[var(--accent-ink)] hover:underline">
                  Edit
                </button>
                <button onClick={() => remove(l.id)} className="text-xs text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {links.length > 0 && (
        <p className="text-xs text-black/40 px-1">
          GC sends at most one link per message and only when it earns its place. It never sends a link instead of
          answering.
        </p>
      )}

      {draft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setDraft(null)}>
          <div
            className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3 [box-shadow:var(--shadow-lg)] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold tracking-tight">{draft.id ? "Edit link" : "Add a link"}</h2>

            <label className="block text-xs">
              <span className="text-black/45">What is it (GC uses this name when it shares it)</span>
              <input
                value={draft.label ?? ""}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Official Claríty page on maeglobalofficial.com"
                className={inputCls}
              />
            </label>

            <label className="block text-xs">
              <span className="text-black/45">URL</span>
              <input
                value={draft.url ?? ""}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                placeholder="https://maeglobalofficial.com/..."
                className={inputCls}
              />
            </label>

            <label className="block text-xs">
              <span className="text-black/45">Kind of proof</span>
              <select
                value={draft.kind ?? "OTHER"}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                className={inputCls}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                    {k.hint ? ` — ${k.hint}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs">
              <span className="text-black/45">When should GC send it? (this is what stops link spam)</span>
              <textarea
                value={draft.note ?? ""}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                rows={2}
                placeholder="When they ask whether it's safe or halal certified"
                className={inputCls}
              />
            </label>

            <label className="block text-xs">
              <span className="text-black/45">Only for one product? (optional)</span>
              <select
                value={draft.productId ?? ""}
                onChange={(e) => setDraft({ ...draft, productId: e.target.value || null })}
                className={inputCls}
              >
                <option value="">Any product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm pt-1">
              <input
                type="checkbox"
                checked={draft.isActive ?? true}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              />
              Active (GC can send this)
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button onClick={() => save(draft)} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
