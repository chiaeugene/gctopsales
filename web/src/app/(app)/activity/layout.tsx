import { AdminOnly } from "@/components/AdminOnly";

// Boss-only: this page shows every agent's activity.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminOnly>{children}</AdminOnly>;
}
