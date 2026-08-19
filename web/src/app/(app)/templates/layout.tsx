import { AdminOnly } from "@/components/AdminOnly";

// Boss-only page — see AdminOnly for why the gate lives server-side.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminOnly>{children}</AdminOnly>;
}
