import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  padding?: "none" | "sm" | "md";
  /** Anchor name for the guided tour to spotlight this card. */
  "data-tour"?: string;
};

// v2 surface: translucent white over the aurora canvas with a light blur, a
// bright top edge (glass highlight) and purple-tinted elevation. `interactive`
// strengthens the lift for genuinely clickable cards.
export function Card({ children, className = "", interactive = false, padding = "md", ...rest }: CardProps) {
  const pad = padding === "none" ? "" : padding === "sm" ? "p-4" : "p-5";
  return (
    <div
      {...rest}
      className={[
        "rounded-2xl bg-white/[0.82] backdrop-blur-md",
        "border border-white/70 ring-1 ring-black/[0.05]",
        "[box-shadow:var(--shadow-sm)]",
        "transition-all duration-300 ease-out",
        interactive
          ? "hover:[box-shadow:var(--shadow-purple)] hover:-translate-y-1 hover:ring-[var(--accent-soft-2)]"
          : "hover:[box-shadow:var(--shadow-md)] hover:-translate-y-0.5",
        pad,
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
