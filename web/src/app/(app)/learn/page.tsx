"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type Case = {
  id: string;
  outcome: "WON" | "LOST" | string;
  headline: string;
  whatWorked: string;
  whatToAvoid: string;
  keyQuote: string | null;
  turningPoint: string | null;
  transcript: string;
  productLine: string | null;
  market: string | null;
  valueMyr: number | null;
  score: number | null;
  isShared: boolean;
  isMine: boolean;
  agent: string;
  createdAt: string;
};
type Patterns = { wins: string[]; losses: string[]; basedOn: number };

export default function LearnPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [filter, setFilter] = useState<"ALL" | "WON" | "LOST">("ALL");
  const [open, setOpen] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<Patterns | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/learning");
    const json = await res.json();
    if (res.ok) setCases(json.cases);
    else setError(json.error || "Could not load cases");
    setLoaded(true);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function findPatterns() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not read patterns");
        return;
      }
      setPatterns(json);
    } finally {
      setBusy(false);
    }
  }

  async function toggleShare(c: Case) {
    await fetch("/api/learning", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, isShared: !c.isShared }),
    });
    await load();
  }

  const shown = filter === "ALL" ? cases : cases.filter((c) => c.outcome === filter);
  const won = cases.filter((c) => c.outcome === "WON").length;
  const lost = cases.filter((c) => c.outcome === "LOST").length;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <PageHeader
        title="Learning hub"
        subtitle="Real conversations that closed, and real ones that didn't, turned into lessons you can use. Customer names and numbers are removed before anything is shared."
      />
      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* Patterns first: the thing you cannot see from one conversation. */}
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold">What keeps working, what keeps costing</h2>
            <p className="text-sm text-black/45">
              Patterns across every case, not one conversation&rsquo;s opinion. Only things that showed up more than
              once.
            </p>
          </div>
          <Button variant="secondary" onClick={findPatterns} disabled={busy || cases.length < 3}>
            {busy ? "Reading…" : patterns ? "Refresh" : "Find patterns"}
          </Button>
        </div>

        {cases.length < 3 && loaded && (
          <p className="text-xs text-black/40">Needs at least 3 cases. You have {cases.length}.</p>
        )}

        {patterns && (
          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
              <div className="text-xs font-semibold text-emerald-900 mb-1.5">Keeps winning</div>
              <ul className="space-y-1">
                {patterns.wins.map((w, i) => (
                  <li key={i} className="text-[13px] text-emerald-900 leading-snug">
                    · {w}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <div className="text-xs font-semibold text-amber-900 mb-1.5">Keeps costing</div>
              <ul className="space-y-1">
                {patterns.losses.map((w, i) => (
                  <li key={i} className="text-[13px] text-amber-900 leading-snug">
                    · {w}
                  </li>
                ))}
              </ul>
            </div>
            <p className="sm:col-span-2 text-[11px] text-black/35">Based on {patterns.basedOn} cases.</p>
          </div>
        )}
      </Card>

      {/* Filter */}
      <div className="flex items-center gap-1.5">
        {(["ALL", "WON", "LOST"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
              (filter === f ? "bg-[var(--ink)] text-white" : "bg-black/[0.04] text-black/55 hover:bg-black/[0.07]")
            }
          >
            {f === "ALL" ? `All ${cases.length}` : f === "WON" ? `Won ${won}` : `Lost ${lost}`}
          </button>
        ))}
      </div>

      {loaded && cases.length === 0 && (
        <Card>
          <p className="text-sm text-black/45">
            No cases yet. They build automatically from conversations that reach a paid order or get marked Lost, so
            the hub fills itself as your team sells.
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {shown.map((c) => {
          const isOpen = open === c.id;
          const won_ = c.outcome === "WON";
          return (
            <div key={c.id} className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : c.id)}
                className="w-full text-left px-3.5 py-3 hover:bg-black/[0.02] transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={
                      "mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 " +
                      (won_ ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")
                    }
                  >
                    {won_ ? "WON" : "LOST"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug">{c.headline}</span>
                    <span className="block text-[11px] text-black/40 mt-0.5">
                      {[c.productLine, c.market, c.valueMyr ? `RM${Math.round(c.valueMyr)}` : null, `by ${c.agent}`]
                        .filter(Boolean)
                        .join(" · ")}
                      {c.score != null ? ` · scored ${c.score}/100` : ""}
                    </span>
                  </span>
                  {c.isShared && <Badge>shared</Badge>}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-black/[0.06] px-3.5 py-3 space-y-3">
                  {c.turningPoint && (
                    <p className="text-sm">
                      <span className="font-semibold">Where it turned: </span>
                      <span className="text-black/65">{c.turningPoint}</span>
                    </p>
                  )}
                  {c.keyQuote && (
                    <blockquote className="border-l-2 border-[var(--accent)] pl-3 text-sm italic text-black/70">
                      {c.keyQuote}
                    </blockquote>
                  )}

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-semibold text-emerald-800 mb-1">What worked</div>
                      <p className="text-[13px] text-black/65 whitespace-pre-line leading-snug">{c.whatWorked}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-amber-800 mb-1">What to avoid</div>
                      <p className="text-[13px] text-black/65 whitespace-pre-line leading-snug">{c.whatToAvoid}</p>
                    </div>
                  </div>

                  <details className="group">
                    <summary className="cursor-pointer text-xs font-medium text-[var(--accent-ink)] hover:underline">
                      Read the whole conversation
                    </summary>
                    <pre className="mt-2 max-h-96 overflow-y-auto rounded-xl bg-black/[0.03] p-3 text-[12px] leading-relaxed whitespace-pre-wrap font-sans text-black/70">
                      {c.transcript}
                    </pre>
                  </details>

                  {c.isMine && (
                    <div className="pt-1">
                      <button
                        onClick={() => toggleShare(c)}
                        className="text-xs font-medium text-[var(--accent-ink)] hover:underline"
                      >
                        {c.isShared ? "Stop sharing with the team" : "Share this with the team"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {cases.length > 0 && (
        <p className="text-xs text-black/40 px-1">
          Cases build themselves from real orders. Names and phone numbers are stripped before a case is written, and
          the transcript is copied so a lesson survives even if the chat is deleted.
        </p>
      )}
    </div>
  );
}
