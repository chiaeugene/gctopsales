import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Vanilla shadcn/ui Button primitive. Named `shadcn-button` (not `button.tsx`)
// because this filesystem is case-insensitive and the project already has a
// PascalCase `Button.tsx` used everywhere else — `Button.tsx` and
// `button.tsx` would collide as the same file on disk. Variant colors here
// use our own CSS custom properties (--accent, --ink, etc.) since the project
// doesn't define shadcn's default --primary/--secondary theme tokens.
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft-2)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "text-white bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-ink)_100%)] hover:brightness-110 [box-shadow:var(--shadow-purple)]",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-black/15 bg-white text-[var(--ink)] hover:bg-black/[0.03]",
        secondary: "bg-[var(--accent-soft)] text-[var(--accent-ink)] hover:bg-[var(--accent-soft-2)]",
        ghost: "text-black/60 hover:bg-black/[0.04] hover:text-[var(--ink)]",
        link: "text-[var(--accent-ink)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-full px-3",
        lg: "h-11 rounded-full px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const ShadcnButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
ShadcnButton.displayName = "ShadcnButton";

export { ShadcnButton, buttonVariants };
