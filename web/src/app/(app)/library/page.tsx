"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AlertIcon, CheckIcon } from "@/components/ui/icons";

type Asset = {
  id: string;
  kind: string;
  label: string;
  note: string | null;
  productId: string | null;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  isActive: boolean;
  url: string;
};
type Product = { id: string; name: string };

const KINDS: { value: string; label: string; why: string }[] = [
  { value: "CERT", label: "Certificate / lab report", why: "Answers “is this safe?” and “is it halal?”" },
  { value: "DELIVERY", label: "Delivery proof", why: "Answers the unspoken “will my parcel actually arrive?”" },
  { value: "PRICE_CARD", label: "Price card", why: "Send this instead of a link when they just want to see prices" },
  { value: "LABEL", label: "Label close-up", why: "Registration number, batch, expiry — proves it’s genuine stock" },
  { value: "PRODUCT", label: "Extra product shot", why: "In-hand, unboxing, size comparison" },
  { value: "TEAM", label: "You / your shop", why: "Puts a real human behind the account" },
  { value: "OTHER", label: "Other", why: "" },
];
const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

// The two assets the market research says matter most and that nobody thinks to
// upload. Called out explicitly rather than left for the agent to discover.
const RECOMMENDED = [
  { kind: "CERT", text: "A halal or NPRA certificate. MY and BN buyers ask for this, and GC currently has nothing to show." },
  { kind: "DELIVERY", text: "One packed-parcel or tracking photo. Buyers are judging whether YOU are real, not just the product." },
];

const inputCls =
  "mt-1.5 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow";

export default function LibraryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productPhotos, setProductPhotos] = useState<{ total: number; withPhoto: number; products: number }>({
    total: 0,
    withPhoto: 0,
    products: 0,
  });
  const [resultPhotos, setResultPhotos] = useState<{ total: number; withPhoto: number }>({ total: 0, withPhoto: 0 });
  const [linkCount, setLinkCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ kind: string; label: string; note: string; productId: string } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [a, p, t, l] = await Promise.all([
      fetch("/api/assets"),
      fetch("/api/products"),
      fetch("/api/testimonials"),
      fetch("/api/links"),
    ]);
    if (a.ok) {
      const j = await a.json();
      setAssets(j.assets);
      setProducts(j.products);
    }
    if (p.ok) {
      const j = await p.json();
      const list = j.products as { attachments: unknown[] }[];
      setProductPhotos({
        products: list.length,
        withPhoto: list.filter((x) => x.attachments.length > 0).length,
        total: list.reduce((n, x) => n + x.attachments.length, 0),
      });
    }
    if (t.ok) {
      const j = await t.json();
      const list = j.testimonials as { photoUrl: string | null }[];
      setResultPhotos({ total: list.length, withPhoto: list.filter((x) => x.photoUrl).length });
    }
    if (l.ok) setLinkCount((await l.json()).links.length);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  function pickFile(kind: string) {
    setDraft({ kind, label: "", note: "", productId: "" });
    // Let the modal mount before opening the OS picker.
    setTimeout(() => fileRef.current?.click(), 0);
  }

  async function upload() {
    if (!draft || !pendingFile) {
      setError("Choose a file first.");
      return;
    }
    if (!draft.label.trim()) {
      setError("Give it a short label so GC knows what it shows.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", pendingFile);
      form.append("kind", draft.kind);
      form.append("label", draft.label);
      if (draft.note.trim()) form.append("note", draft.note);
      if (draft.productId) form.append("productId", draft.productId);
      const res = await fetch("/api/assets", { method: "POST", body: form });
      if (!res.ok) {
        setError((await res.json()).error || "Upload failed");
        return;
      }
      setDraft(null);
      setPendingFile(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(a: Asset) {
    await fetch("/api/assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, isActive: !a.isActive }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this file? GC will no longer be able to send it.")) return;
    await fetch("/api/assets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  const activeAssets = assets.filter((a) => a.isActive);
  const missing = RECOMMENDED.filter((r) => !activeAssets.some((a) => a.kind === r.kind));
  const sendableTotal = activeAssets.length + productPhotos.total + resultPhotos.withPhoto + linkCount;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <PageHeader
        title="Library"
        subtitle="Everything GC is allowed to send a customer, in one place. GC can only ever send what is listed here — it cannot invent a file, a photo or a link."
      />
      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* The headline answer to "what will the bot send?" */}
      <Card className="!py-3">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
          <span className="text-sm">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{sendableTotal}</span>{" "}
            <span className="text-black/45">things GC can send</span>
          </span>
          <span className="text-xs text-black/45">
            {productPhotos.total} product photo{productPhotos.total === 1 ? "" : "s"} · {activeAssets.length} proof file
            {activeAssets.length === 1 ? "" : "s"} · {resultPhotos.withPhoto} result photo
            {resultPhotos.withPhoto === 1 ? "" : "s"} · {linkCount} link{linkCount === 1 ? "" : "s"}
          </span>
        </div>
      </Card>

      {/* Gaps worth fixing, named specifically. */}
      {missing.length > 0 && (
        <Card className="!border-amber-200 !bg-amber-50 space-y-2">
          <h2 className="font-semibold text-amber-900 flex items-center gap-2 text-sm">
            <AlertIcon className="w-4 h-4 shrink-0" />
            Worth adding
          </h2>
          <ul className="space-y-1.5">
            {missing.map((r) => (
              <li key={r.kind} className="text-sm text-amber-900 flex items-start justify-between gap-3">
                <span>{r.text}</span>
                <button
                  onClick={() => pickFile(r.kind)}
                  className="text-xs font-medium underline shrink-0 whitespace-nowrap"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Section 1: the files managed right here. */}
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold">Proof files</h2>
            <p className="text-sm text-black/45">
              Certificates, delivery proof, price cards, label close-ups. These do not belong to any one product, which
              is why they live here.
            </p>
          </div>
          <Button onClick={() => pickFile("CERT")}>+ Upload file</Button>
        </div>

        {assets.length === 0 ? (
          <p className="text-sm text-black/35">Nothing here yet.</p>
        ) : (
          <div className="divide-y divide-black/[0.05] -mx-1">
            {assets.map((a) => (
              <div key={a.id} className="group/row flex items-start gap-3 px-1 py-2.5">
                {a.fileType === "PHOTO" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-black/[0.06]" />
                ) : (
                  <span className="w-10 h-10 rounded-lg bg-black/[0.04] shrink-0 grid place-items-center text-[10px] font-semibold text-black/40">
                    PDF
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{a.label}</span>
                    <Badge>{KIND_LABEL[a.kind] ?? a.kind}</Badge>
                    {!a.isActive && <Badge tone="danger">off</Badge>}
                  </div>
                  {a.note ? (
                    <p className="text-xs text-black/45 mt-0.5">When: {a.note}</p>
                  ) : (
                    <p className="text-xs text-amber-600 mt-0.5">
                      No “when to send” note — GC has to guess the moment
                    </p>
                  )}
                </div>
                <div className="flex gap-2.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 transition-opacity">
                  <button onClick={() => toggle(a)} className="text-xs text-[var(--accent-ink)] hover:underline">
                    {a.isActive ? "Turn off" : "Turn on"}
                  </button>
                  <button onClick={() => remove(a.id)} className="text-xs text-red-600 hover:underline">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Sections 2-4: the other three sources, summarised so this page really is
          the complete picture, each managed on its own page. */}
      <div className="grid sm:grid-cols-3 gap-3">
        <SourceCard
          title="Product photos"
          href="/products"
          ok={productPhotos.withPhoto === productPhotos.products && productPhotos.products > 0}
          main={`${productPhotos.total}`}
          detail={
            productPhotos.products === 0
              ? "No products yet"
              : `${productPhotos.withPhoto} of ${productPhotos.products} products have one`
          }
        />
        <SourceCard
          title="Result photos"
          href="/testimonials"
          ok={resultPhotos.withPhoto > 0}
          main={`${resultPhotos.withPhoto}`}
          detail={`of ${resultPhotos.total} written results have a photo`}
        />
        <SourceCard
          title="Links"
          href="/links"
          ok={linkCount > 0}
          main={`${linkCount}`}
          detail={linkCount === 0 ? "GC has no link to prove you're real" : "approved for GC to send"}
        />
      </div>

      <p className="text-xs text-black/40 px-1">
        GC picks from this library on its own, using each item&rsquo;s label and &ldquo;when to send&rdquo; note. It never
        sends two files back to back, never re-sends the same one in a conversation, and never sends before/after body
        photos.
      </p>

      {/* Upload modal */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setPendingFile(f);
            // Pre-fill the label from the filename — better than an empty box.
            setDraft((d) => (d ? { ...d, label: d.label || f.name.replace(/\.[^.]+$/, "") } : d));
          }
          e.target.value = "";
        }}
      />

      {draft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setDraft(null)}>
          <div
            className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3 [box-shadow:var(--shadow-lg)] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold tracking-tight">Add a file GC can send</h2>

            <div className="rounded-xl border border-black/[0.08] px-3.5 py-2.5 text-sm flex items-center justify-between gap-3">
              <span className={pendingFile ? "" : "text-black/40"}>
                {pendingFile ? pendingFile.name : "No file chosen"}
              </span>
              <button onClick={() => fileRef.current?.click()} className="text-xs font-medium text-[var(--accent-ink)] hover:underline shrink-0">
                {pendingFile ? "Change" : "Choose file"}
              </button>
            </div>

            <label className="block text-xs">
              <span className="text-black/45">What kind of proof is it?</span>
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} className={inputCls}>
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                    {k.why ? ` — ${k.why}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs">
              <span className="text-black/45">Label (GC reads this to decide if the file fits the moment)</span>
              <input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="JAKIM halal certificate for BCODE+"
                className={inputCls}
              />
            </label>

            <label className="block text-xs">
              <span className="text-black/45">When should GC send it?</span>
              <textarea
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                rows={2}
                placeholder="When they ask if it's halal, or whether it's safe to take"
                className={inputCls}
              />
            </label>

            <label className="block text-xs">
              <span className="text-black/45">Only for one product? (optional)</span>
              <select
                value={draft.productId}
                onChange={(e) => setDraft({ ...draft, productId: e.target.value })}
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

            <p className="text-xs text-amber-700">
              Do not upload before/after body or skin transformation photos. Malaysian advertising rules prohibit
              visuals showing changes in the human body, and Singapore treats them as a disease-treatment claim.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft(null);
                  setPendingFile(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={upload} disabled={busy}>
                {busy ? "Uploading…" : "Add to library"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SourceCard(props: { title: string; href: string; ok: boolean; main: string; detail: string }) {
  return (
    <Link href={props.href} className="block">
      <Card className="h-full !py-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-black/55">{props.title}</span>
          {props.ok ? (
            <CheckIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <AlertIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          )}
        </div>
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{props.main}</div>
        <p className="text-[11px] text-black/40 leading-snug">{props.detail}</p>
      </Card>
    </Link>
  );
}
