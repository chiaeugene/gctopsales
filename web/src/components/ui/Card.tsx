import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  padding?: "none" | "sm" | "md";
};

// Base surface used across the app instead of the old
// `rounded-xl bg-white border border-neutral-200` string. Every card gets a
// subtle hover lift by default — `interactive` just makes it stronger for
// genuinely clickable cards (podium tiles, scenario rows).
export function Card({ children, className = "", interactive = false, padding = "md" }: CardProps) {
  const pad = padding === "none" ? "" : padding === "sm" ? "p-4" : "p-5";
  return (
    <div
      className={[
        "rounded-2xl bg-white border border-black/[0.06]",
        "[box-shadow:var(--shadow-sm)]",
        "transition-all duration-300 ease-out",
        interactive
          ? "hover:[box-shadow:var(--shadow-purple)] hover:-translate-y-1 hover:border-[var(--accent-soft-2)]"
          : "hover:[box-shadow:var(--shadow-md)] hover:-translate-y-0.5",
        pad,
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
