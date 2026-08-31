"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { CheckIcon } from "@/components/ui/icons";

/**
 * The agent's own progress, shown as things achieved rather than things owed.
 *
 * A checklist of what is missing reads as nagging by the second day. The same
 * information framed as ground already covered reads as momentum, and the next
 * unreached item still says exactly what to do next — it is just the one line
 * after the wins rather than a wall of red before them.
 */
type Milestone = { key: string; title: string; detail: string; reached: boolean };

export function Milestones() {
  const [items, setItems] = useState<Milestone[] | null>(null);

  useEffect(() => {
    fetch("/api/milestones")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setItems(j.milestones))
      .catch(() => {});
  }, []);

  if (!items) return null;
  const done = items.filter((m) => m.reached);
  const next = items.find((m) => !m.reached);
  if (done.length === 0) return null;

  const newest = done[done.length - 1];

  return (
    <Card className="!border-emerald-200 !bg-emerald-50/70 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-emerald-900">{newest.title}</h2>
        <span className="shrink-0 text-xs tabular-nums text-emerald-900/50">
          {done.length} of {items.length}
        </span>
      </div>
      <p className="text-sm text-emerald-900/75">{newest.detail}</p>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {done.slice(0, -1).map((m) => (
          <span
            key={m.key}
            className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[11px] text-emerald-900"
          >
            <CheckIcon className="w-3 h-3" />
            {m.title}
          </span>
        ))}
      </div>
      {next && (
        <p className="border-t border-emerald-200/70 pt-2 text-sm text-emerald-900/70">
          <strong>Next:</strong> {next.title.replace(/^You /, "")} — {next.detail}
        </p>
      )}
    </Card>
  );
}
