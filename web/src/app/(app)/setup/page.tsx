"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: string; content: string };

// Conversational setup interview — GC interviews the agent to fill the four
// brains (especially payment details) instead of a cold form.
export default function SetupPage() {
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
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Set up GC</h1>
        <p className="text-sm text-neutral-500">
          A quick conversational setup — GC will ask about your store voice, selling style, and (most importantly) your
          payment details. Everything is saved to your brains automatically; you can fine-tune later in Settings.
        </p>
      </div>

      {done && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          ✅ Setup complete — GC is configured. You can refine anything in <a href="/settings" className="underline">Settings</a>, or{" "}
          <a href="/playground" className="underline">test GC now</a>.
        </div>
      )}

      <div className="rounded-xl bg-white border border-neutral-200 min-h-[24rem] flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!started && (
            <div className="text-center mt-16">
              <button onClick={start} disabled={busy} className="rounded-lg bg-violet-700 text-white px-5 py-2.5 text-sm font-semibold hover:bg-violet-800 disabled:opacity-50">
                {busy ? "Starting…" : "Start setup interview"}
              </button>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "CUSTOMER" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "CUSTOMER"
                    ? "max-w-[80%] rounded-2xl rounded-br-sm bg-violet-600 text-white px-4 py-2 text-sm whitespace-pre-wrap"
                    : "max-w-[80%] rounded-2xl rounded-bl-sm bg-neutral-100 px-4 py-2 text-sm whitespace-pre-wrap"
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && started && <div className="text-xs text-neutral-400">GC is typing…</div>}
          <div ref={bottomRef} />
        </div>
        {started && (
          <form onSubmit={send} className="p-3 border-t border-neutral-200 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer…"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button type="submit" disabled={busy || !input.trim()} className="rounded-lg bg-violet-700 text-white px-4 py-2 text-sm font-semibold hover:bg-violet-800 disabled:opacity-50">
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
