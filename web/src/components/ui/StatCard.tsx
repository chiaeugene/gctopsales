import type { ReactNode } from "react";
import { Card } from "./Card";

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
          <div className="text-[13px] text-black/50 font-medium">{label}</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
          {hint && <div className="mt-1 text-xs text-black/40">{hint}</div>}
        </div>
        {icon && <div className="text-black/30">{icon}</div>}
      </div>
    </Card>
  );
}
