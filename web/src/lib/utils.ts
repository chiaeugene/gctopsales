import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn/ui helper — merges conditional classNames and resolves
// conflicting Tailwind utilities (last one wins) so component consumers can
// override styles via a `className` prop safely.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
