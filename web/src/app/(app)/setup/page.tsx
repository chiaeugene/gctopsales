"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import { useT } from "@/components/I18nProvider";

type Msg = { role: string; content: string };

// Conversational setup interview — GC interviews the agent to fill the four
// brains (especially payment details) instead of a cold form.
export default function SetupPage() {
  const { t } = useT();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/onboarding");
      const json = await res.json();
      if (res.ok) {
        setMessages(json.messages);
        setStarted(json.messages.length > 0);
        setDone(json.onboardingStatus === "COMPLETED");
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function turn(message: string | null) {
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessages((m) => [...m, ...(message ? [{ role: "CUSTOMER", content: message }] : []), { role: "GC", content: json.reply }]);
        if (json.readyToWrapUp || json.onboardingStatus === "COMPLETED") setDone(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setStarted(true);
    await turn(null);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const text = input.trim();
    setInput("");
    await turn(text);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">
      <PageHeader title={t("setup.title")} subtitle={t("setup.subtitle")} />

      {!done && (
        <div className="rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-xs text-black/55 space-y-1">
          <div className="font-semibold text-black/70 text-[13px]">{t("setup.learnsTitle")}</div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>{t("setup.learn.tone")}</li>
            <li>{t("setup.learn.payment")}</li>
            <li>{t("setup.learn.shipping")}</li>
            <li>{t("setup.learn.customers")}</li>
          </ul>
          <div className="pt-0.5 text-black/40">{t("setup.learnsFootnote")}</div>
        </div>
      )}

      {done && (
        <Card className="!bg-emerald-50 !border-emerald-200 flex items-start gap-2.5 text-sm text-emerald-900">
          <CheckIcon className="w-4 h-4 mt-0.5 shrink-0 text-emerald-700" />
          <span>
            {t("setup.done.prefix")}
            <a href="/settings" className="underline">{t("setup.done.settings")}</a>
            {t("setup.done.or")}
            <a href="/playground" className="underline">{t("setup.done.test")}</a>
            {t("setup.done.suffix")}
          </span>
        </Card>
      )}

      <Card data-tour="setup-interview" padding="none" className="min-h-[24rem] flex flex-col">
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {!started && (
            <div className="text-center mt-16">
              <Button onClick={start} disabled={busy}>
                {busy ? t("setup.starting") : t("setup.startBtn")}
              </Button>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "CUSTOMER" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "CUSTOMER"
                    ? "max-w-[80%] rounded-2xl rounded-br-md bg-[var(--ink)] text-white px-4 py-2.5 text-sm whitespace-pre-wrap"
                    : "max-w-[80%] rounded-2xl rounded-bl-md bg-black/[0.04] px-4 py-2.5 text-sm whitespace-pre-wrap"
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && started && <div className="text-xs text-black/35">{t("setup.typing")}</div>}
          <div ref={bottomRef} />
        </div>
        {started && (
          <form onSubmit={send} className="p-3.5 border-t border-black/[0.06] flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("setup.inputPlaceholder")}
              className="flex-1 rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow"
            />
            <Button type="submit" disabled={busy || !input.trim()}>
              {t("setup.send")}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
