"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FileIcon } from "@/components/ui/icons";

// Real MAE product-line photography (downloaded from maeglobalofficial.com —
// we're their agent). Shown once per series as a full-size banner rather than
// squeezed into every small SKU card, where it just cropped to nothing.
const SERIES_IMAGE: Record<string, string> = {
  "BCODE+": "/mae/product-bcode.webp",
  "Claríty Skincare": "/mae/product-skincare.webp",
  "Claríty Anti-Aging": "/mae/product-skincare.webp",
  "Healthcare (Total DX+)": "/mae/product-detox.webp",
  "BRB (Mental Wellness)": "/mae/product-brb.webp",
  "Re.WIND Hair": "/mae/product-hair.webp",
};

type Attachment = { id: string; fileName: string; label: string | null; fileType: string; url: string };
type Product = {
  id: string;
  name: string;
  code: string | null;
  series: string | null;
  priceMemberMyr: number;
  priceRetailMyr: number;
  priceMemberSgd: number | null;
  priceRetailSgd: number | null;
  pointValue: number;
  boxCount: number | null;
  contents: string[];
  gifts: string[];
  description: string | null;
  sellingPoints: string | null;
  isActive: boolean;
  attachments: Attachment[];
};

const BLANK: Partial<Product> = {
  name: "",
  series: "",
  code: "",
  priceMemberMyr: 0,
  priceRetailMyr: 0,
  description: "",
  sellingPoints: "",
  isActive: true,
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/products");
    const json = await res.json();
    if (!res.ok) setError(json.error || "Failed to load");
    else setProducts(json.products);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(p: Partial<Product>) {
    setError(null);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: p.id,
        name: p.name,
        code: p.code || null,
        series: p.series || null,
        priceMemberMyr: Number(p.priceMemberMyr) || 0,
        priceRetailMyr: Number(p.priceRetailMyr) || 0,
        priceMemberSgd: p.priceMemberSgd ? Number(p.priceMemberSgd) : null,
        priceRetailSgd: p.priceRetailSgd ? Number(p.priceRetailSgd) : null,
        pointValue: Number(p.pointValue) || 0,
        boxCount: p.boxCount ? Number(p.boxCount) : null,
        contents: p.contents ?? [],
        gifts: p.gifts ?? [],
        description: p.description || null,
        sellingPoints: p.sellingPoints || null,
        isActive: p.isActive ?? true,
      }),
    });
    if (!res.ok) {
      setError((await res.json()).error || "Save failed");
      return;
    }
    setEditing(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this product?")) return;
    await fetch("/api/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  const bySeries = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.series || "Other";
    if (!bySeries.has(key)) bySeries.set(key, []);
    bySeries.get(key)!.push(p);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        subtitle="The catalog GC sells from. Attach photos/PDFs and GC will send them when the label matches the moment."
        action={<Button onClick={() => setEditing({ ...BLANK })}>+ New product</Button>}
      />
      {error && <div className="text-sm text-red-600">{error}</div>}

      {[...bySeries.entries()].map(([series, items]) => {
        const img = SERIES_IMAGE[series];
        return (
          <section key={series} className="space-y-3">
            {/* One generous banner per series — shows the real photography properly
                instead of cropping it into every small SKU card. */}
            <div className="relative rounded-2xl overflow-hidden h-40 sm:h-48">
              {img ? (
                <>
                  <Image src={img} alt="" fill className="object-cover" sizes="900px" />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(12,12,14,0.75) 0%, rgba(12,12,14,0.35) 45%, rgba(12,12,14,0.05) 75%)",
                    }}
                  />
                </>
              ) : (
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-ink) 100%)" }}
                />
              )}
              <div className="absolute inset-0 flex flex-col justify-center px-6">
                <h2 className="font-semibold text-2xl tracking-tight text-white">{series}</h2>
                <p className="text-white/70 text-sm mt-0.5">{items.length} product{items.length > 1 ? "s" : ""}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((p) => {
                const saving = p.priceRetailMyr - p.priceMemberMyr;
                return (
                  <Card key={p.id} interactive className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm">{p.name}</div>
                      {p.code && <Badge tone="neutral">{p.code}</Badge>}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-semibold tracking-tight text-[var(--accent-ink)] tabular-nums">
                        RM{p.priceMemberMyr.toLocaleString()}
                      </span>
                      <span className="text-xs text-black/35 line-through tabular-nums">RM{p.priceRetailMyr.toLocaleString()}</span>
                      {saving > 0 && <span className="text-xs text-emerald-600 font-medium tabular-nums">save RM{saving.toLocaleString()}</span>}
                    </div>
                    {p.description && <p className="text-xs text-black/60 line-clamp-2">{p.description}</p>}
                    {p.gifts.length > 0 && <p className="text-xs text-amber-700">Gift: {p.gifts.join(" · ")}</p>}
                    {p.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.attachments.map((a) => (
                          <Badge key={a.id} tone="accent" icon={<FileIcon className="w-3 h-3" />}>
                            {a.label || a.fileName}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {!p.isActive && <p className="text-xs text-red-600 font-medium">Inactive — hidden from GC</p>}
                    <div className="flex gap-3 pt-1">
                      <button onClick={() => setEditing(p)} className="text-xs text-[var(--accent-ink)] hover:underline">
                        Edit
                      </button>
                      <button onClick={() => remove(p.id)} className="text-xs text-red-600 hover:underline">
                        Delete
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}

      {editing && (
        <ProductEditor
          product={editing}
          onClose={() => setEditing(null)}
          onSave={save}
          onAttachmentsChanged={load}
        />
      )}
    </div>
  );
}

function ProductEditor(props: {
  product: Partial<Product>;
  onClose: () => void;
  onSave: (p: Partial<Product>) => void;
  onAttachmentsChanged: () => void;
}) {
  const [p, setP] = useState<Partial<Product>>(props.product);
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Product>) => setP((cur) => ({ ...cur, ...patch }));

  async function upload(file: File) {
    if (!p.id) {
      alert("Save the product first, then add attachments.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (label.trim()) form.append("label", label.trim());
      const res = await fetch(`/api/products/${p.id}/attachments`, { method: "POST", body: form });
      if (res.ok) {
        const created = await res.json();
        set({ attachments: [...(p.attachments ?? []), created] });
        setLabel("");
        props.onAttachmentsChanged();
      } else {
        alert((await res.json()).error || "Upload failed");
      }
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(id: string) {
    await fetch(`/api/attachments/${id}/delete`, { method: "POST" });
    set({ attachments: (p.attachments ?? []).filter((a) => a.id !== id) });
    props.onAttachmentsChanged();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={props.onClose}>
      <div
        className="bg-white rounded-2xl border border-black/[0.06] [box-shadow:var(--shadow-lg)] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold tracking-tight">{p.id ? "Edit product" : "New product"}</h2>

        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Name" value={p.name ?? ""} onChange={(v) => set({ name: v })} />
          <Field label="Series" value={p.series ?? ""} onChange={(v) => set({ series: v })} />
          <Field label="Code" value={p.code ?? ""} onChange={(v) => set({ code: v })} />
          <Field label="Box count" type="number" value={String(p.boxCount ?? "")} onChange={(v) => set({ boxCount: v ? Number(v) : null })} />
          <Field label="Member price (RM)" type="number" value={String(p.priceMemberMyr ?? 0)} onChange={(v) => set({ priceMemberMyr: Number(v) })} />
          <Field label="Retail price (RM)" type="number" value={String(p.priceRetailMyr ?? 0)} onChange={(v) => set({ priceRetailMyr: Number(v) })} />
          <Field label="Member price (S$) — Singapore only, optional" type="number" value={p.priceMemberSgd != null ? String(p.priceMemberSgd) : ""} onChange={(v) => set({ priceMemberSgd: v ? Number(v) : null })} />
          <Field label="Retail price (S$) — Singapore only, optional" type="number" value={p.priceRetailSgd != null ? String(p.priceRetailSgd) : ""} onChange={(v) => set({ priceRetailSgd: v ? Number(v) : null })} />
        </div>
        <p className="text-xs text-black/40">
          Leave SGD blank if you don&apos;t sell to Singapore — GC then confirms SG pricing with you instead of quoting RM.
        </p>

        <FieldArea label="Description" value={p.description ?? ""} onChange={(v) => set({ description: v })} rows={2} />
        <FieldArea
          label="Selling notes (GC's ammo: who it's for, mechanism story, objection answers)"
          value={p.sellingPoints ?? ""}
          onChange={(v) => set({ sellingPoints: v })}
          rows={5}
        />

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.isActive ?? true} onChange={(e) => set({ isActive: e.target.checked })} />
          Active (GC can sell this)
        </label>

        {/* Attachments */}
        <div className="border-t border-black/[0.06] pt-3 space-y-2">
          <div className="text-sm font-semibold">Attachments GC can send</div>
          {!p.id && <p className="text-xs text-black/45">Save the product first to add attachments.</p>}
          {(p.attachments ?? []).map((a) => (
            <div key={a.id} className="flex items-center justify-between text-xs bg-black/[0.03] rounded-lg px-3 py-2">
              <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[var(--accent-ink)] hover:underline">
                <FileIcon className="w-3.5 h-3.5" /> {a.label || a.fileName} <span className="text-black/40">({a.fileType})</span>
              </a>
              <button onClick={() => removeAttachment(a.id)} className="text-red-600 hover:underline">
                Remove
              </button>
            </div>
          ))}
          {p.id && (
            <div className="flex gap-2 items-end">
              <label className="block text-xs flex-1">
                <span className="text-black/45">When should GC send it? (label)</span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Total DX+ price card, before/after testimonial"
                  className="mt-1 w-full rounded-lg border border-black/[0.1] px-2 py-1.5 text-sm"
                />
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
              <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? "Uploading…" : "Upload file"}
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-black/[0.06] pt-3">
          <Button variant="secondary" onClick={props.onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={() => props.onSave(p)}>
            Save product
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block text-xs">
      <span className="text-black/45">{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-black/[0.1] px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function FieldArea(props: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <label className="block text-xs">
      <span className="text-black/45">{props.label}</span>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        rows={props.rows}
        className="mt-1 w-full rounded-lg border border-black/[0.1] px-2 py-1.5 text-sm"
      />
    </label>
  );
}
