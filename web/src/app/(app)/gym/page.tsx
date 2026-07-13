"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { DumbbellIcon } from "@/components/ui/icons";

type ScenarioResult = {
  key: string;
  title: string;
  skill: string;
  score: number;
  verdict: "pass" | "weak" | "fail";
  note: string;
  exchange: { role: "customer" | "gc"; content: string }[];
};
type GymReport = {
  overall: number;
  bySkill: { skill: string; avg: number }[];
  weakest: ScenarioResult[];
  results: ScenarioResult[];
  coaching: string;
  ranAt: string;
};

export default function GymPage() {
  const [report, setReport] = useState<GymReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    setApplied(false);
    try {
      const res = await fetch("/api/gym/run", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Stress test failed");
        return;
      }
      setReport(json.report);
    } finally {
      setBusy(false);
    }
  }

  async function applyCoaching() {
    if (!report) return;
    const res = await fetch("/api/gym/apply-coaching", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coaching: report.coaching }),
    });
    if (res.ok) setApplied(true);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Sales Gym"
        subtitle="Runs GC against the hardest MAE selling situations — Shopee-cheaper, skeptics, drug fears, pregnancy safety, rebound, rude customers — grades each response, and shows exactly where she's strong or weak."
        action={
          <Button onClick={run} disabled={busy}>
            {busy ? "Running… (~1 min)" : report ? "Re-run" : "Run stress test"}
          </Button>
        }
      />
      {error && <div className="text-sm text-red-600">{error}</div>}
      {busy && (
        <div className="flex items-center gap-2 text-sm text-black/40">
          <DumbbellIcon className="w-4 h-4 animate-pulse" />
          GC is being tested against every scenario in parallel — hang tight…
        </div>
      )}

      {report && (
        <>
          <Card className="animate-fade-up">
            <div className="flex items-center gap-6">
              <ScoreRing value={report.overall} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold mb-2">Skill breakdown (weakest first)</div>
                <div className="space-y-2">
                  {report.bySkill.map((s) => (
                    <div key={s.skill}>
                      <div className="flex justify-between text-xs text-black/45 mb-1">
                        <span>{s.skill}</span>
                        <span className="tabular-nums">{s.avg}/10</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-black/[0.05] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${s.avg >= 8 ? "bg-emerald-500" : s.avg >= 5 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${s.avg * 10}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Coaching */}
          <Card className="!bg-amber-50 !border-amber-200">
            <div className="font-semibold text-sm text-amber-900 mb-1.5">Coaching to level GC up</div>
            <pre className="text-xs text-amber-900 whitespace-pre-wrap font-sans leading-relaxed">{report.coaching}</pre>
            {!report.coaching.includes("no weak spots") && (
              <button
                onClick={applyCoaching}
                disabled={applied}
                className="mt-3 rounded-full bg-amber-600 text-white px-4 py-1.5 text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {applied ? "Added to GC's brain ✓" : "Add this coaching to GC's Sales Brain"}
              </button>
            )}
          </Card>

          {/* Per-scenario */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">All {report.results.length} scenarios</div>
            {report.results.map((r) => (
              <Card key={r.key} padding="none">
                <button onClick={() => setOpen(open === r.key ? null : r.key)} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{r.title}</div>
                    <div className="text-xs text-black/35">{r.skill} · {r.note}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <VerdictBadge verdict={r.verdict} />
                    <span className="text-sm font-semibold text-black/60 tabular-nums">{r.score}/10</span>
                  </div>
                </button>
                {open === r.key && (
                  <div className="px-4 pb-3.5 space-y-2 border-t border-black/[0.05] pt-3">
                    {r.exchange.map((e, i) => (
                      <div key={i} className="text-xs">
                        <span className={e.role === "customer" ? "font-semibold text-black/45" : "font-semibold text-[var(--accent-ink)]"}>
                          {e.role === "customer" ? "Customer" : "GC"}:
                        </span>{" "}
                        <span className="whitespace-pre-wrap text-black/70">{e.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const tone = verdict === "pass" ? "success" : verdict === "weak" ? "warm" : "danger";
  return <Badge tone={tone as "success" | "warm" | "danger"}>{verdict}</Badge>;
}
