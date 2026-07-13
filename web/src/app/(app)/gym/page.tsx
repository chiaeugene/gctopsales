"use client";

import { useState } from "react";

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

  const grade = (n: number) => (n >= 85 ? "A" : n >= 75 ? "B" : n >= 65 ? "C" : n >= 50 ? "D" : "F");

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Gym — stress test GC</h1>
          <p className="text-sm text-neutral-500">
            Runs GC against the hardest MAE selling situations (Shopee-cheaper, skeptics, drug fears, pregnancy safety,
            rebound, rude customers…), grades each response, and shows exactly where she&apos;s strong or weak.
          </p>
        </div>
        <button onClick={run} disabled={busy} className="rounded-lg bg-violet-700 text-white px-5 py-2.5 text-sm font-semibold hover:bg-violet-800 disabled:opacity-50">
          {busy ? "Running… (~1 min)" : report ? "Re-run" : "Run stress test"}
        </button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {busy && <div className="text-sm text-neutral-400">GC is being tested against every scenario in parallel — hang tight…</div>}

      {report && (
        <>
          <div className="rounded-xl bg-white border border-neutral-200 p-5 flex items-center gap-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-violet-700">{grade(report.overall)}</div>
              <div className="text-xs text-neutral-500">{report.overall}/100</div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold mb-1">Skill breakdown (weakest first)</div>
              <div className="space-y-1">
                {report.bySkill.map((s) => (
                  <div key={s.skill}>
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>{s.skill}</span>
                      <span>{s.avg}/10</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                      <div className={`h-full ${s.avg >= 8 ? "bg-emerald-500" : s.avg >= 5 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${s.avg * 10}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Coaching */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
            <div className="font-semibold text-sm text-amber-900">💡 Coaching to level GC up</div>
            <pre className="text-xs text-amber-900 whitespace-pre-wrap font-sans">{report.coaching}</pre>
            {!report.coaching.includes("no weak spots") && (
              <button onClick={applyCoaching} disabled={applied} className="rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-700 disabled:opacity-50">
                {applied ? "Added to GC's brain ✓" : "Add this coaching to GC's Sales Brain"}
              </button>
            )}
          </div>

          {/* Per-scenario */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">All {report.results.length} scenarios</div>
            {report.results.map((r) => (
              <div key={r.key} className="rounded-xl bg-white border border-neutral-200">
                <button onClick={() => setOpen(open === r.key ? null : r.key)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{r.title}</div>
                    <div className="text-xs text-neutral-400">{r.skill} · {r.note}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <VerdictBadge verdict={r.verdict} />
                    <span className="text-sm font-bold text-neutral-600">{r.score}/10</span>
                  </div>
                </button>
                {open === r.key && (
                  <div className="px-4 pb-3 space-y-2 border-t border-neutral-100 pt-2">
                    {r.exchange.map((e, i) => (
                      <div key={i} className={e.role === "customer" ? "text-xs" : "text-xs"}>
                        <span className={e.role === "customer" ? "font-semibold text-neutral-500" : "font-semibold text-violet-700"}>
                          {e.role === "customer" ? "Customer" : "GC"}:
                        </span>{" "}
                        <span className="whitespace-pre-wrap">{e.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const style = verdict === "pass" ? "bg-emerald-100 text-emerald-700" : verdict === "weak" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{verdict}</span>;
}
