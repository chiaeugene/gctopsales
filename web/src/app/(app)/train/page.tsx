"use client";

import { useEffect, useRef, useState } from "react";

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Train GC</h1>
          <p className="text-sm text-neutral-500">
            You're the seller; GC plays real MAE customer types. Reply in your own voice — GC learns how you sell.
          </p>
        </div>
        <button
          onClick={synthesize}
          disabled={busy}
          className="rounded-lg bg-violet-700 text-white px-4 py-2 text-sm font-semibold hover:bg-violet-800 disabled:opacity-50"
        >
          Learn my style →
        </button>
      </div>

      {styleResult && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="font-semibold mb-1">GC will now sound more like you:</div>
          {styleResult}
        </div>
      )}

      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        {/* Scenario list */}
        <div className="w-64 shrink-0 space-y-2 overflow-y-auto">
          {scenarios.map((s) => (
            <button
              key={s.key}
              onClick={() => startScenario(s)}
              className={
                "block w-full text-left rounded-xl border p-3 " +
                (active?.key === s.key ? "border-violet-500 bg-violet-50" : "border-neutral-200 bg-white hover:bg-neutral-50")
              }
            >
              <div className="text-sm font-medium">{s.title}</div>
              <div className="text-xs text-neutral-500 line-clamp-2">{s.focus}</div>
            </button>
          ))}
        </div>

        {/* Chat */}
        <div className="flex-1 rounded-xl bg-white border border-neutral-200 flex flex-col min-w-0">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-neutral-400">
              Pick a customer type to start role-playing.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-neutral-200 text-sm">
                <span className="font-semibold">{active.title}</span> — you are the seller
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "AGENT" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        m.role === "AGENT"
                          ? "max-w-[75%] rounded-2xl rounded-br-sm bg-violet-600 text-white px-4 py-2 text-sm whitespace-pre-wrap"
                          : "max-w-[75%] rounded-2xl rounded-bl-sm bg-neutral-100 px-4 py-2 text-sm whitespace-pre-wrap"
                      }
                    >
                      {m.role === "CUSTOMER" && <div className="text-[10px] text-neutral-400 mb-0.5">Customer (GC)</div>}
                      {m.content}
                    </div>
                  </div>
                ))}
                {busy && <div className="text-xs text-neutral-400">Customer is typing…</div>}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={send} className="p-3 border-t border-neutral-200 flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Reply as the seller (your own words)…"
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button type="submit" disabled={busy || !input.trim()} className="rounded-lg bg-violet-700 text-white px-4 py-2 text-sm font-semibold hover:bg-violet-800 disabled:opacity-50">
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
