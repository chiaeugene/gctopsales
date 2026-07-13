"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StarIcon } from "@/components/ui/icons";

type Scenario = { key: string; title: string; opener: string; focus: string };
type Msg = { role: "AGENT" | "CUSTOMER"; content: string };

// Train GC: the agent plays the SELLER against GC playing 12 MAE customer
// archetypes. Their demonstrated voice is synthesized into GC's style.
export default function TrainPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [active, setActive] = useState<Scenario | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [styleResult, setStyleResult] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/training");
      const json = await res.json();
      if (res.ok) setScenarios(json.scenarios);
    })();
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startScenario(s: Scenario) {
    setActive(s);
    setStyleResult(null);
    // GC (customer) opens with the scenario opener.
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
      if (res.ok) setMessages((m) => [...m, { role: "CUSTOMER", content: json.customerReply }]);
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
    <div className="space-y-5">
      <PageHeader
        title="Train GC"
        subtitle="You're the seller; GC plays real MAE customer types. Reply in your own voice — GC learns how you sell."
        action={
          <Button onClick={synthesize} disabled={busy}>
            Learn my style
          </Button>
        }
      />

      {styleResult && (
        <Card className="!bg-emerald-50 !border-emerald-200 flex items-start gap-2.5 text-sm text-emerald-900">
          <StarIcon className="w-4 h-4 mt-0.5 shrink-0 text-emerald-700" />
          <div>
            <div className="font-semibold mb-1">GC will now sound more like you:</div>
            {styleResult}
          </div>
        </Card>
      )}

      <div className="flex gap-5 h-[calc(100vh-12rem)]">
        {/* Scenario list */}
        <div className="w-64 shrink-0 space-y-2 overflow-y-auto">
          {scenarios.map((s) => (
            <button key={s.key} onClick={() => startScenario(s)} className="block w-full text-left">
              <Card
                interactive
                padding="sm"
                className={active?.key === s.key ? "!border-[var(--accent)] !bg-[var(--accent-soft)]" : ""}
              >
                <div className="text-sm font-medium">{s.title}</div>
                <div className="text-xs text-black/45 line-clamp-2 mt-0.5">{s.focus}</div>
              </Card>
            </button>
          ))}
        </div>

        {/* Chat */}
        <Card padding="none" className="flex-1 flex flex-col min-w-0">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-black/35">
              Pick a customer type to start role-playing.
            </div>
          ) : (
            <>
              <div className="px-5 py-3.5 border-b border-black/[0.06] text-sm">
                <span className="font-semibold">{active.title}</span>
                <span className="text-black/45"> — you are the seller</span>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "AGENT" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        m.role === "AGENT"
                          ? "max-w-[75%] rounded-2xl rounded-br-md bg-[var(--ink)] text-white px-4 py-2.5 text-sm whitespace-pre-wrap"
                          : "max-w-[75%] rounded-2xl rounded-bl-md bg-black/[0.04] px-4 py-2.5 text-sm whitespace-pre-wrap"
                      }
                    >
                      {m.role === "CUSTOMER" && <div className="text-[10px] text-black/35 mb-0.5">Customer (GC)</div>}
                      {m.content}
                    </div>
                  </div>
                ))}
                {busy && <div className="text-xs text-black/35">Customer is typing…</div>}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={send} className="p-3.5 border-t border-black/[0.06] flex gap-2">
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
