"use client";

import { useState } from "react";

/**
 * The public sign-up page — the Google Form, but ours.
 *
 * Four questions, because every extra field costs completions and an admin can
 * fill in the rest later. Nothing here creates an account: it creates a request
 * an admin approves, so the page is safe to share in a group chat.
 */
export default function JoinPage() {
  const [form, setForm] = useState({ name: "", leaderName: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Could not reach the server. Please check your connection.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none transition-shadow focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]";

  return (
    <main className="min-h-screen px-4 py-12 sm:py-20">
      <div className="mx-auto w-full max-w-md">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent-ink)]">GC · AI Sales Team</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Join your team on GC</h1>
        <p className="mt-2.5 text-sm leading-relaxed text-black/55">
          GC answers your customers on WhatsApp in your name, in their language, around the clock. Fill this in and your
          leader will confirm your account.
        </p>

        {done ? (
          <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
            <h2 className="font-semibold text-emerald-900">Thanks, {form.name.split(" ")[0]}.</h2>
            <p className="mt-1.5 text-sm text-emerald-900/80">
              Your leader will confirm your account shortly. When they do, sign in with this email and{" "}
              <strong>the last 6 digits of your phone number</strong> as your passcode.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl border border-black/[0.06] bg-white/80 p-6 backdrop-blur">
            <label className="block text-xs">
              <span className="font-medium text-black/70">Your full name</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={field}
                autoComplete="name"
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-black/70">Your leader&apos;s name</span>
              <input
                value={form.leaderName}
                onChange={(e) => setForm({ ...form, leaderName: e.target.value })}
                className={field}
                placeholder="Who introduced you to MAE"
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-black/70">Email</span>
              <span className="block text-black/40">You will sign in with this.</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={field}
                autoComplete="email"
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-black/70">Phone number</span>
              <span className="block text-black/40">The last 6 digits become your passcode, so no password to forget.</span>
              <input
                required
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={field}
                autoComplete="tel"
                placeholder="012-3456789"
              />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-ink)_100%)] px-5 py-3 text-sm font-medium text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-40"
            >
              {busy ? "Sending…" : "Request my account"}
            </button>
            <p className="text-center text-[11px] text-black/35">
              Already have an account? <a href="/login" className="text-[var(--accent-ink)] hover:underline">Sign in</a>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
