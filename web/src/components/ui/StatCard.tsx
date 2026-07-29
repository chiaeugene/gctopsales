import type { ReactNode } from "react";
import { Card } from "./Card";

// Data tile: label above a mono numeral (function-forward 2026 style).
export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <Card padding="md">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12px] uppercase tracking-wide text-black/45 font-medium">{label}</div>
          <div className="num mt-1.5 text-[27px] leading-none font-semibold text-[var(--ink)]">{value}</div>
          {hint && <div className="mt-1.5 text-xs text-black/40">{hint}</div>}
        </div>
        {icon && <div className="text-black/25">{icon}</div>}
      </div>
    </Card>
  );
}
