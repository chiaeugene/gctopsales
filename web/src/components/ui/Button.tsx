import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-[var(--ink)] text-white hover:bg-[var(--accent-ink)]",
  secondary: "bg-black/[0.04] text-[var(--ink)] hover:bg-black/[0.07]",
  ghost: "text-black/50 hover:text-[var(--ink)] hover:bg-black/[0.04]",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={[
        "rounded-full px-5 py-2.5 text-sm font-medium transition-colors duration-200",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        styles[variant],
        className,
      ].join(" ")}
    />
  );
}
