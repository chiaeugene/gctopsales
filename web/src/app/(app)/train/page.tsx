"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StarIcon, CheckIcon } from "@/components/ui/icons";

type Scenario = { key: string; title: string; opener: string; focus: string };
type Msg = { role: "AGENT" | "CUSTOMER"; content: string; saved?: boolean };

// Train GC: the agent plays the SELLER against GC playing MAE customer
// archetypes. EVERY reply the agent sends is saved as a training example and
// injected into GC's live sales prompt — plus the style profile auto-refreshes
// so GC's voice drifts toward the agent's.
export default function TrainPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [active, setActive] = useState<Scenario | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [styleResult, setStyleResult] = useState<string | null>(null);
  const [exampleCount, setExampleCount] = useState<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/training");
      const json = await res.json();
      if (res.ok) {
        setScenarios(json.scenarios);
        setExampleCount(json.exampleCount ?? 0);
        if (json.styleProfile) setStyleResult(json.styleProfile);
      }
    })();
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startScenario(s: Scenario) {
    setActive(s);
    setMessages([{ role: "CUSTOMER", content: s.opener }]);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy || !active) return;
    const text = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "AGENT", content: text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", scenarioKey: active.key, message: text }),
      });
      const json = await res.json();
      if (res.ok) {
        if (json.saved) {
          setMessages((m) =>
            m.map((msg, i) => (i === m.length - 1 && msg.role === "AGENT" ? { ...msg, saved: true } : msg))
          );
          if (typeof json.exampleCount === "number") setExampleCount(json.exampleCount);
        }
        setMessages((m) => [...m, { role: "CUSTOMER", content: json.customerReply }]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function synthesize() {
    setBusy(true);
    try {
      const res = await fetch("/api/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "synthesize" }),
      });
      const json = await res.json();
      setStyleResult(json.styleProfile || "Not enough of your replies yet — role-play a few more scenarios first.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Train GC"
        subtitle="You play the seller; GC plays your toughest customers. Every reply you type is saved and GC starts selling in YOUR voice."
        action={
          <Button onClick={synthesize} disabled={busy}>
            Refresh my style
          </Button>
        }
      />

      {/* Live training status — proof that typing here changes the bot */}
      <Card padding="sm" className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <strong>{exampleCount}</strong>&nbsp;replies learned
        </span>
        <span className="text-xs text-black/45">
          GC re-reads your latest replies before every real customer message. The more you train, the more she sounds
          like you.
        </span>
      </Card>

      {styleResult && (
        <Card className="!bg-emerald-50 !border-emerald-200 flex items-start gap-2.5 text-sm text-emerald-900">
          <StarIcon className="w-4 h-4 mt-0.5 shrink-0 text-emerald-700" />
          <div>
            <div className="font-semibold mb-1">GC&apos;s current impression of your style:</div>
            {styleResult}
          </div>
        </Card>
      )}

      <div className="flex flex-col md:flex-row gap-4 md:gap-5 md:h-[calc(100vh-16rem)]">
        {/* Scenario picker — chips on mobile, list on desktop */}
        <div className="md:w-64 shrink-0 md:space-y-2 md:overflow-y-auto flex md:block gap-2 overflow-x-auto pb-1 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
          {scenarios.map((s) => (
            <button key={s.key} onClick={() => startScenario(s)} className="shrink-0 md:block md:w-full text-left">
              <Card
                interactive
                padding="sm"
                className={
                  "w-56 md:w-auto " + (active?.key === s.key ? "!border-[var(--accent)] !bg-[var(--accent-soft)]" : "")
                }
              >
                <div className="text-sm font-medium">{s.title}</div>
                <div className="text-xs text-black/45 line-clamp-2 mt-0.5">{s.focus}</div>
              </Card>
            </button>
          ))}
        </div>

        {/* Chat */}
        <Card padding="none" className="flex-1 flex flex-col min-w-0 h-[60dvh] md:h-auto">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-black/35 p-6 text-center">
              Pick a customer type to start role-playing. Reply the way YOU would sell.
            </div>
          ) : (
            <>
              <div className="px-4 sm:px-5 py-3 border-b border-black/[0.06] text-sm">
                <span className="font-semibold">{active.title}</span>
                <span className="text-black/45"> — you are the seller</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "AGENT" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        m.role === "AGENT"
                          ? "max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-md bg-[var(--ink)] text-white px-4 py-2.5 text-sm whitespace-pre-wrap"
                          : "max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-bl-md bg-black/[0.04] px-4 py-2.5 text-sm whitespace-pre-wrap"
                      }
                    >
                      {m.role === "CUSTOMER" && <div className="text-[10px] text-black/35 mb-0.5">Customer (GC)</div>}
                      {m.content}
                      {m.role === "AGENT" && m.saved && (
                        <div className="mt-1 text-[10px] text-emerald-300 inline-flex items-center gap-1">
                          <CheckIcon className="w-3 h-3" /> GC learned this reply
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {busy && <div className="text-xs text-black/35">Customer is typing…</div>}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={send} className="p-2.5 sm:p-3.5 border-t border-black/[0.06] flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Reply as the seller (your own words)…"
                  className="flex-1 rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-shadow"
                />
                <Button type="submit" disabled={busy || !input.trim()}>
                  Send
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
