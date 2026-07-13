"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-neutral-500">
            The catalog GC sells from. Attach photos/PDFs and GC will send them when the label matches the moment.
          </p>
        </div>
        <button
          onClick={() => setEditing({ ...BLANK })}
          className="rounded-lg bg-violet-700 text-white px-4 py-2 text-sm font-semibold hover:bg-violet-800"
        >
          + New product
        </button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}

      {[...bySeries.entries()].map(([series, items]) => (
        <section key={series} className="space-y-2">
          <h2 className="font-semibold text-lg">{series}</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((p) => {
              const saving = p.priceRetailMyr - p.priceMemberMyr;
              return (
                <div key={p.id} className="rounded-xl bg-white border border-neutral-200 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm">{p.name}</div>
                    {p.code && <span className="text-[10px] rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-500">{p.code}</span>}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-violet-700">RM{p.priceMemberMyr.toLocaleString()}</span>
                    <span className="text-xs text-neutral-400 line-through">RM{p.priceRetailMyr.toLocaleString()}</span>
                    {saving > 0 && <span className="text-xs text-emerald-600 font-medium">save RM{saving.toLocaleString()}</span>}
                  </div>
                  {p.description && <p className="text-xs text-neutral-600 line-clamp-2">{p.description}</p>}
                  {p.gifts.length > 0 && <p className="text-xs text-amber-700">🎁 {p.gifts.join(" · ")}</p>}
                  {p.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.attachments.map((a) => (
                        <span key={a.id} className="text-[10px] rounded bg-violet-50 text-violet-700 px-1.5 py-0.5">
                          📎 {a.label || a.fileName}
                        </span>
                      ))}
                    </div>
                  )}
                  {!p.isActive && <p className="text-xs text-red-600 font-medium">Inactive — hidden from GC</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditing(p)} className="text-xs text-violet-700 hover:underline">
                      Edit
                    </button>
                    <button onClick={() => remove(p.id)} className="text-xs text-red-600 hover:underline">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

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
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">{p.id ? "Edit product" : "New product"}</h2>

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
        <p className="text-xs text-neutral-400">
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
        <div className="border-t border-neutral-200 pt-3 space-y-2">
          <div className="text-sm font-semibold">Attachments GC can send</div>
          {!p.id && <p className="text-xs text-neutral-500">Save the product first to add attachments.</p>}
          {(p.attachments ?? []).map((a) => (
            <div key={a.id} className="flex items-center justify-between text-xs bg-neutral-50 rounded-lg px-3 py-2">
              <a href={a.url} target="_blank" rel="noreferrer" className="text-violet-700 hover:underline">
                📎 {a.label || a.fileName} <span className="text-neutral-400">({a.fileType})</span>
              </a>
              <button onClick={() => removeAttachment(a.id)} className="text-red-600 hover:underline">
                Remove
              </button>
            </div>
          ))}
          {p.id && (
            <div className="flex gap-2 items-end">
              <label className="block text-xs flex-1">
                <span className="text-neutral-500">When should GC send it? (label)</span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Total DX+ price card, before/after testimonial"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
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
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Upload file"}
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <button onClick={props.onClose} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">
            Close
          </button>
          <button
            onClick={() => props.onSave(p)}
            className="rounded-lg bg-violet-700 text-white px-4 py-2 text-sm font-semibold hover:bg-violet-800"
          >
            Save product
          </button>
        </div>
      </div>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block text-xs">
      <span className="text-neutral-500">{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function FieldArea(props: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <label className="block text-xs">
      <span className="text-neutral-500">{props.label}</span>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        rows={props.rows}
        className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
      />
    </label>
  );
}
