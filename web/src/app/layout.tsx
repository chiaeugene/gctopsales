import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GC Top Sales",
  description: "AI sales machine for MAE Global agents — WhatsApp, Instagram, Messenger.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
