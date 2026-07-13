import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary:
    "text-white bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-ink)_100%)] hover:brightness-110 [box-shadow:var(--shadow-purple)]",
  secondary: "bg-[var(--accent-soft)] text-[var(--accent-ink)] hover:bg-[var(--accent-soft-2)]",
  ghost: "text-black/50 hover:text-[var(--accent-ink)] hover:bg-black/[0.04]",
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
