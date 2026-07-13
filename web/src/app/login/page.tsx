"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--canvas)]">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <div className="text-[26px] font-semibold tracking-tight text-[var(--ink)]">GC Top Sales</div>
          <p className="mt-1.5 text-[14px] text-black/45">AI sales machine for MAE agents</p>
        </div>
        <form onSubmit={submit} className="rounded-2xl bg-white [box-shadow:var(--shadow-lg)] border border-black/[0.06] p-8 space-y-4">
          <label className="block">
            <span className="text-[13px] font-medium text-black/70">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow"
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium text-black/70">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-[var(--ink)] text-white py-2.5 text-sm font-medium hover:bg-[var(--accent-ink)] disabled:opacity-40 transition-colors"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
