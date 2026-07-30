"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type Menu = {
  id: string;
  topic: string;
  question: string;
  options: string[];
  followUpNote: string | null;
  isActive: boolean;
};

const inputCls =
  "mt-1.5 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow";

const BLANK: Partial<Menu> = { topic: "", question: "", options: ["", "", ""], isActive: true };

export default function DiscoveryPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [allowLists, setAllowLists] = useState(false);
  const [draft, setDraft] = useState<Partial<Menu> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/discovery");
    const json = await res.json();
    if (res.ok) {
      setMenus(json.menus);
      setAllowLists(json.allowLists);
    } else {
      setError(json.error || "Could not load your menus");
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(d: Partial<Menu>) {
    setError(null);
    const options = (d.options ?? []).map((o) => o.trim()).filter(Boolean);
    if (!d.topic?.trim() || !d.question?.trim() || options.length < 2) {
      setError("A menu needs a topic, a question, and at least 2 options.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: d.id,
          topic: d.topic,
          question: d.question,
          options,
          followUpNote: d.followUpNote || null,
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
    if (!confirm("Delete this discovery menu?")) return;
    await fetch("/api/discovery", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function loadStarters() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/discovery", { method: "PUT" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not load the starter set");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Discovery menus"
        subtitle={
          <>
            The opening move top sellers use: instead of &ldquo;how can I help?&rdquo;, GC asks the customer to
            pick their problem from a short list. Picking is much easier than writing, so far more people reply,
            and their answer tells GC exactly what to sell.
          </>
        }
        action={<Button onClick={() => setDraft({ ...BLANK })}>+ Add menu</Button>}
      />

      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* The library says WHAT to ask; the Settings switch says HOW it looks.
          Without this, an agent turns lists off and can't tell why the numbers
          disappeared. */}
      <Card className="!py-3 text-xs flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-black/45">Format right now:</span>
        {allowLists ? (
          <span className="font-medium">numbered options (1. 2. 3.)</span>
        ) : (
          <span className="font-medium">asked in prose, no numbers</span>
        )}
        <Link href="/settings" className="text-[var(--accent-ink)] hover:underline">
          change in Settings
        </Link>
        <span className="text-black/35">
          · the same questions get asked either way, only the formatting changes
        </span>
      </Card>

      {loaded && menus.length === 0 && (
        <Card className="space-y-3">
          <h2 className="font-semibold">Start with the MAE set</h2>
          <p className="text-sm text-black/50">
            Six ready-made menus covering skin, gut, weight, hair, sleep and eyes, each already mapped to the
            right MAE line. Load them, then edit the wording to sound like you.
          </p>
          <Button onClick={loadStarters} disabled={busy}>
            {busy ? "Loading…" : "Load the 6 MAE starter menus"}
          </Button>
        </Card>
      )}

      <div className="space-y-2">
        {menus.map((m) => (
          <Card key={m.id} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge>{m.topic}</Badge>
                  {!m.isActive && <Badge tone="danger">off</Badge>}
                </div>
                <div className="mt-1.5 text-sm font-medium">{m.question}</div>
              </div>
              <div className="flex gap-3 shrink-0">
                <button onClick={() => setDraft(m)} className="text-xs text-[var(--accent-ink)] hover:underline">
                  Edit
                </button>
                <button onClick={() => remove(m.id)} className="text-xs text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </div>

            {/* Shown the way the customer will see it, so an agent can judge it
                at a glance rather than imagining it. */}
            <div className="rounded-xl bg-black/[0.03] px-3.5 py-2.5 text-sm space-y-0.5">
              {m.options.map((o, i) => (
                <div key={i}>{allowLists ? `${i + 1}. ${o}` : `· ${o}`}</div>
              ))}
            </div>

            {m.followUpNote && (
              <p className="text-xs text-black/40">
                <span className="font-medium text-black/55">GC&rsquo;s private note:</span> {m.followUpNote}
              </p>
            )}
          </Card>
        ))}

        {menus.length > 0 && (
          <p className="text-xs text-black/40 px-1">
            GC asks at most ONE menu per conversation, at the start, and skips it entirely when the customer
            already said what their problem is.
          </p>
        )}
      </div>

      {draft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setDraft(null)}>
          <div
            className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3 [box-shadow:var(--shadow-lg)] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold tracking-tight">{draft.id ? "Edit menu" : "New discovery menu"}</h2>

            <label className="block text-xs">
              <span className="text-black/45">Problem area (GC matches this to what the customer mentions)</span>
              <input
                value={draft.topic ?? ""}
                onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
                placeholder="Skin"
                className={inputCls}
              />
            </label>

            <label className="block text-xs">
              <span className="text-black/45">The question GC asks</span>
              <textarea
                value={draft.question ?? ""}
                onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                rows={2}
                placeholder="Which one bothers you most about your skin right now?"
                className={inputCls}
              />
            </label>

            <div className="text-xs">
              <span className="text-black/45">Options (2 to 5 — keep them short, 3 works best)</span>
              <div className="mt-1.5 space-y-2">
                {(draft.options ?? []).map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-4 text-black/35 tabular-nums">{i + 1}.</span>
                    <input
                      value={o}
                      onChange={(e) => {
                        const next = [...(draft.options ?? [])];
                        next[i] = e.target.value;
                        setDraft({ ...draft, options: next });
                      }}
                      placeholder="Big pores & oily"
                      className="flex-1 rounded-xl border border-black/10 px-3.5 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                    />
                    {(draft.options?.length ?? 0) > 2 && (
                      <button
                        onClick={() =>
                          setDraft({ ...draft, options: (draft.options ?? []).filter((_, j) => j !== i) })
                        }
                        className="text-red-600 text-sm px-1"
                        title="Remove this option"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {(draft.options?.length ?? 0) < 5 && (
                <button
                  onClick={() => setDraft({ ...draft, options: [...(draft.options ?? []), ""] })}
                  className="mt-2 text-[11px] font-medium text-[var(--accent-ink)] hover:underline"
                >
                  + Add option
                </button>
              )}
            </div>

            <label className="block text-xs">
              <span className="text-black/45">
                What each answer means (private — GC reads this, the customer never sees it)
              </span>
              <textarea
                value={draft.followUpNote ?? ""}
                onChange={(e) => setDraft({ ...draft, followUpNote: e.target.value })}
                rows={3}
                placeholder="Pores/oily → Claríty mask. Dark spots → GLO2. Dull → REP1 then GLO2."
                className={inputCls}
              />
            </label>

            <label className="flex items-center gap-2 text-sm pt-1">
              <input
                type="checkbox"
                checked={draft.isActive ?? true}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              />
              Active (GC can use this menu)
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
