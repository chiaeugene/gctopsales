import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "hot" | "warm" | "cold" | "success" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-black/[0.05] text-black/60",
  accent: "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
  hot: "bg-[var(--hot-soft)] text-[var(--hot)]",
  warm: "bg-amber-50 text-amber-700",
  cold: "bg-sky-50 text-sky-700",
  success: "bg-emerald-50 text-emerald-700",
  danger: "bg-red-50 text-red-600",
};

export function Badge({ children, tone = "neutral", icon }: { children: ReactNode; tone?: Tone; icon?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  );
}
