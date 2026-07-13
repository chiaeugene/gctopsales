import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 animate-fade-up">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ink)]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-black/50 max-w-2xl">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
