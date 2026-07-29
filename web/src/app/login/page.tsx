"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

// Platform front door: this sells the VISION (an AI sales team for any
// business), not one product line. Aurora-lit light canvas, one glass panel,
// quiet confidence — no stock photography, no product shots.
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
      setError("Invalid email or passcode · 邮箱或密码不正确");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-dvh grid lg:grid-cols-2">
      {/* Vision side */}
      <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl [box-shadow:var(--shadow-purple)]"
            style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-ink) 100%)" }}
          />
          <span className="text-[17px] font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            GC
            <span className="text-black/35 font-medium"> · AI Sales Team</span>
          </span>
        </div>

        <div className="max-w-lg">
          <h1
            className="text-[44px] xl:text-[52px] font-semibold leading-[1.05] tracking-[-0.035em] text-[var(--ink)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Every business deserves a{" "}
            <span className="bg-clip-text text-transparent bg-[linear-gradient(120deg,var(--accent)_0%,#c026d3_100%)]">
              closer
            </span>
            .
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-black/50 max-w-md">
            GC learns your products, your rules, and your voice, then sells for you in every chat, in any language,
            around the clock. You stay in control of every ringgit.
          </p>

          <div className="mt-9 grid grid-cols-3 gap-3 max-w-md">
            {[
              ["Trained by you", "Role-play once, sell forever"],
              ["Every channel", "WhatsApp · IG · Messenger"],
              ["Your rules", "Prices and payments locked"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl glass border ring-1 ring-black/[0.04] px-3.5 py-3">
                <div className="text-[13px] font-semibold text-[var(--ink)]">{k}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-black/45">{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-[12px] text-black/35">
          © {new Date().getFullYear()} GC · AI Sales Team ·{" "}
          <a href="/privacy" className="hover:text-black/60 transition-colors">Privacy</a> ·{" "}
          <a href="/terms" className="hover:text-black/60 transition-colors">Terms</a>
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-up">
          {/* Mobile brand (vision side hidden) */}
          <div className="lg:hidden text-center mb-8">
            <div
              className="inline-flex items-center gap-2.5 text-[22px] font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <span
                className="w-8 h-8 rounded-xl inline-block [box-shadow:var(--shadow-purple)]"
                style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-ink) 100%)" }}
              />
              GC<span className="text-black/35 font-medium"> · AI Sales Team</span>
            </div>
          </div>

          <form
            onSubmit={submit}
            className="rounded-3xl glass border ring-1 ring-black/[0.05] [box-shadow:var(--shadow-lg)] p-8 space-y-5"
          >
            <div>
              <h2 className="text-[22px] font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Welcome back
              </h2>
              <p className="mt-1 text-[13px] text-black/45">Sign in to your sales workspace · 登录你的销售工作台</p>
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
            <p className="text-[11px] text-black/35 text-center">
              No account? Ask your team admin to create one for you.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
