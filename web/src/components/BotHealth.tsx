"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CheckIcon, AlertIcon } from "@/components/ui/icons";

/**
 * The answer to "will it actually reply?".
 *
 * Every failure in this app so far was invisible until a customer got silence.
 * The point of this panel is that an agent never has to wonder: it walks the
 * chain a message travels and names the first thing that would break it.
 *
 * `compact` is the dashboard strip, which loads cheaply on every visit and stays
 * quiet when everything is fine. The full panel on Connect adds a button that
 * really calls the AI, because a configured key and a working key are different
 * things and only one of them answers customers.
 */
type Check = { key: string; label: string; status: "pass" | "warn" | "fail"; detail: string; fix?: string };
type Result = { ok: boolean; checks: Check[] };

export function BotHealth({ compact = false }: { compact?: boolean }) {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [deep, setDeep] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (full: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/health", { method: full ? "POST" : "GET" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not run the check");
        return;
      }
      setResult(json as Result);
      if (full) setDeep(true);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const fails = result?.checks.filter((c) => c.status === "fail") ?? [];
  const warns = result?.checks.filter((c) => c.status === "warn") ?? [];

  // ------------------------------------------------------------- compact ----
  if (compact) {
    if (!result || (fails.length === 0 && warns.length === 0)) {
      // Silence when healthy. A green banner on every page load becomes wallpaper
      // and stops being read, which is exactly when you need it to be noticed.
      return null;
    }
    const worst = fails.length > 0;
    return (
      <Link
        href="/connect"
        className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm transition-colors ${
          worst
            ? "border-red-200 bg-red-50 text-red-900 hover:bg-red-100"
            : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
        }`}
      >
        <AlertIcon className="w-4 h-4 shrink-0" />
        <span>
          <strong>{worst ? "GC cannot reply to customers" : "GC is running, with something to check"}</strong>
          {" — "}
          {(fails[0] ?? warns[0]).detail}
        </span>
      </Link>
    );
  }

  // ---------------------------------------------------------------- full ----
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Will GC reply to a customer right now?</h2>
          <p className="text-sm text-black/45">
            Checks every step a customer message travels: Meta reaching us, your connection still being accepted, GC
            being able to write, having something to sell, and being able to take payment. The first red one is the
            one to fix.
          </p>
        </div>
        <Button onClick={() => load(true)} disabled={busy}>
          {busy ? "Checking…" : deep ? "Check again" : "Run the full check"}
        </Button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {result && (
        <>
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              fails.length > 0
                ? "bg-red-50 text-red-900 border border-red-200"
                : warns.length > 0
                  ? "bg-amber-50 text-amber-900 border border-amber-200"
                  : "bg-emerald-50 text-emerald-900 border border-emerald-200"
            }`}
          >
            <strong>
              {fails.length > 0
                ? `${fails.length} thing${fails.length === 1 ? "" : "s"} would stop a customer getting a reply`
                : warns.length > 0
                  ? "GC will reply, but there are things worth knowing"
                  : "GC is ready. A customer messaging now would get an answer."}
            </strong>
            {!deep && (
              <span className="block text-xs opacity-80 mt-0.5">
                This is the quick check. &ldquo;Run the full check&rdquo; also sends a real test message to the AI, which
                is the only way to prove the billing balance is not empty.
              </span>
            )}
          </div>

          <ul className="space-y-1.5">
            {result.checks.map((c) => (
              <li key={c.key} className="flex gap-2.5 text-sm">
                <span className="mt-0.5 shrink-0">
                  {c.status === "pass" ? (
                    <CheckIcon className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertIcon className={`w-4 h-4 ${c.status === "fail" ? "text-red-600" : "text-amber-600"}`} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="font-medium">{c.label}</span>
                  <span className="block text-black/50">{c.detail}</span>
                  {c.fix && <span className="block text-[var(--accent-ink)]">{c.fix}</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
