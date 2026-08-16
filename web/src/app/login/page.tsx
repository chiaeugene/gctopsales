"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AnimatedHeadline } from "@/components/ui/animated-headline";

// Platform front door. One centered composition: the vision (animated
// headline) and the sign-in panel sit close together as a single unit
// instead of being flung to opposite screen edges.
export default function LoginPage() {
  const router = useRouter();

  // The tour is meant to run on every login. Its "already seen" flag lives in
  // sessionStorage, which survives signing out and back in within the same
  // browser session — so the second login of the day skipped it. Landing on this
  // page IS the start of a login, so clear the flag here. Every gc-tour-* key
  // goes, not just the current version, so an old one can never linger.
  useEffect(() => {
    for (const k of Object.keys(sessionStorage)) {
      if (k.startsWith("gc-tour-")) sessionStorage.removeItem(k);
    }
  }, []);
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
      setError("Invalid email or passcode · 邮箱或密码不正确");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex flex-col">
      {/* Top bar brand */}
      <header className="flex items-center gap-3 px-6 sm:px-10 pt-6">
        <div
          className="w-8 h-8 rounded-xl [box-shadow:var(--shadow-purple)]"
          style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-ink) 100%)" }}
        />
        <span className="text-[16px] font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          GC
          <span className="text-black/35 font-medium"> · AI Sales Team</span>
        </span>
      </header>

      {/* Centered composition: vision + panel close together */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-4xl grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-14 items-center">
          {/* Vision */}
          <div className="text-center lg:text-left">
            <AnimatedHeadline
              prefix="Every customer deserves"
              words={["a top seller", "a closer", "a 24/7 team", "a sales legend", "GC"]}
              className="text-[40px] sm:text-[48px] leading-[1.08]"
            />
            <p className="mt-5 text-[15.5px] leading-relaxed text-black/50 max-w-md mx-auto lg:mx-0">
              GC learns your products, your rules, and your voice, then sells for you in every chat, in any language,
              around the clock. You stay in control of every ringgit.
            </p>
            <div className="mt-7 flex flex-wrap justify-center lg:justify-start gap-2">
              {["Trained by you", "WhatsApp · IG · Messenger", "Your prices, locked"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full glass border ring-1 ring-black/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-black/60"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* Sign-in panel */}
          <form
            onSubmit={submit}
            className="w-full max-w-sm mx-auto lg:mx-0 rounded-3xl glass border ring-1 ring-black/[0.05] [box-shadow:var(--shadow-lg)] p-7 sm:p-8 space-y-5 animate-fade-up"
          >
            <div>
              <h2 className="text-[21px] font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Welcome back
              </h2>
              <p className="mt-1 text-[13px] text-black/45">Sign in to your workspace · 登录你的销售工作台</p>
            </div>

            <label className="block">
              <span className="text-[13px] font-medium text-black/70">Email · 邮箱</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-white/80 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-black/70">Passcode · 密码</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-white/80 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full text-white py-2.5 text-sm font-medium disabled:opacity-40 transition-all active:scale-[0.98] [box-shadow:var(--shadow-purple)] hover:brightness-110"
              style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-ink) 100%)" }}
            >
              {busy ? "Signing in… · 登录中…" : "Sign in · 登录"}
            </button>
            <p className="text-[11px] text-black/35 text-center">No account yet? <a href="/join" className="text-[var(--accent-ink)] hover:underline font-medium">Request one here</a>.</p>
          </form>
        </div>
      </div>

      <footer className="px-6 sm:px-10 pb-5 text-[12px] text-black/35 text-center lg:text-left">
        © {new Date().getFullYear()} GC · AI Sales Team ·{" "}
        <a href="/privacy" className="hover:text-black/60 transition-colors">Privacy</a> ·{" "}
        <a href="/terms" className="hover:text-black/60 transition-colors">Terms</a>
      </footer>
    </main>
  );
}
