"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "CUSTOMER" | "GC" | "SYSTEM"; content: string; attachmentIds?: string[] };
type OrderState = {
  id: string;
  status: string;
  paymentStatus: string;
  needsHuman: boolean;
  items: { name: string; qty: number; unitPriceMyr: number }[];
  totalMyr: number | null;
  customerName: string | null;
  segment: string | null;
} | null;

// "Pretend to be the customer" sandbox — the exact production pipeline (same
// engine, same guardrails, same image path), zero real customers involved.
export default function PlaygroundPage() {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<OrderState>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function newSession() {
    setError(null);
    const res = await fetch("/api/playground/session", { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to start session");
      return;
    }
    setOrderId(json.orderId);
    setMessages([]);
    setOrder(null);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    let id = orderId;
    if (!id) {
      const res = await fetch("/api/playground/session", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to start session");
        return;
      }
      id = json.orderId as string;
      setOrderId(id);
    }
    const text = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "CUSTOMER", content: text }]);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/playground/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id, message: text }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Something went wrong");
        return;
      }
      if (json.reply) setMessages((m) => [...m, { role: "GC", content: json.reply, attachmentIds: json.attachmentIds }]);
      else if (json.needsHuman)
        setMessages((m) => [...m, { role: "SYSTEM", content: "(Conversation is frozen for human review — GC stays silent, like on a real channel.)" }]);
      if (json.order) setOrder(json.order);
    } finally {
      setBusy(false);
    }
  }

  const voiceRef = useRef<HTMLInputElement>(null);
  async function uploadVoice(file: File) {
    if (!orderId || busy) return;
    setBusy(true);
    setError(null);
    setMessages((m) => [...m, { role: "CUSTOMER", content: `🎤 [voice note: ${file.name}]` }]);
    try {
      const form = new FormData();
      form.append("orderId", orderId);
      form.append("file", file);
      const res = await fetch("/api/playground/inbound-voice", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Voice upload failed");
        return;
      }
      if (json.transcript) {
        setMessages((m) => [...m, { role: "SYSTEM", content: `📝 Transcribed: "${json.transcript}"` }]);
      } else if (json.note) {
        setMessages((m) => [...m, { role: "SYSTEM", content: json.note }]);
      }
      if (json.reply) setMessages((m) => [...m, { role: "GC", content: json.reply, attachmentIds: json.attachmentIds }]);
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    if (!orderId || busy) return;
    setBusy(true);
    setError(null);
    setMessages((m) => [...m, { role: "CUSTOMER", content: `📷 [sent an image: ${file.name}]` }]);
    try {
      const form = new FormData();
      form.append("orderId", orderId);
      form.append("file", file);
      const res = await fetch("/api/playground/inbound-image", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Upload failed");
        return;
      }
      if (json.ackReply) setMessages((m) => [...m, { role: "GC", content: json.ackReply }]);
      if (json.order) setOrder((o) => (o ? { ...o, ...json.order } : json.order));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-6rem)]">
      <div className="flex-1 flex flex-col rounded-xl bg-white border border-neutral-200 min-w-0">
        <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">Test GC (Playground)</div>
            <div className="text-xs text-neutral-500">You are the customer. Full production pipeline, no real channel.</div>
          </div>
          <button onClick={newSession} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50">
            New session
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-neutral-400 text-center mt-10">
              Say hi as a customer — e.g. “hi, 请问 Total DX+ 怎么卖?” or “I keep feeling bloated, any recommendation?”
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "CUSTOMER" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "CUSTOMER"
                    ? "max-w-[75%] rounded-2xl rounded-br-sm bg-violet-600 text-white px-4 py-2 text-sm whitespace-pre-wrap"
                    : m.role === "GC"
                      ? "max-w-[75%] rounded-2xl rounded-bl-sm bg-neutral-100 px-4 py-2 text-sm whitespace-pre-wrap"
                      : "max-w-[85%] rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-xs"
                }
              >
                {m.content}
                {m.attachmentIds && m.attachmentIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.attachmentIds.map((aid) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={aid} src={`/api/attachments/${aid}`} alt="sent attachment" className="rounded-lg max-h-40 border border-neutral-200" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="text-xs text-neutral-400">GC is typing…</div>}
          <div ref={bottomRef} />
        </div>

        {error && <div className="px-4 py-2 text-xs text-red-600 border-t border-neutral-100">{error}</div>}

        <form onSubmit={send} className="p-3 border-t border-neutral-200 flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadImage(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            title="Send a payment-proof image (like a customer would)"
            onClick={() => fileRef.current?.click()}
            disabled={!orderId || busy}
            className="rounded-lg border border-neutral-300 px-3 text-sm hover:bg-neutral-50 disabled:opacity-40"
          >
            📎
          </button>
          <input
            ref={voiceRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadVoice(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            title="Send a voice note (like a customer would)"
            onClick={() => voiceRef.current?.click()}
            disabled={!orderId || busy}
            className="rounded-lg border border-neutral-300 px-3 text-sm hover:bg-neutral-50 disabled:opacity-40"
          >
            🎤
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type as the customer…"
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-lg bg-violet-700 text-white px-4 py-2 text-sm font-semibold hover:bg-violet-800 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>

      <aside className="w-72 shrink-0 rounded-xl bg-white border border-neutral-200 p-4 space-y-3 overflow-y-auto">
        <div className="font-semibold text-sm">Live order state</div>
        {!order && <p className="text-xs text-neutral-400">The machine-side view updates as GC works the sale.</p>}
        {order && (
          <div className="space-y-2 text-sm">
            <Row label="Status" value={order.status} />
            <Row label="Payment" value={order.paymentStatus} />
            <Row label="Customer" value={order.customerName || "—"} />
            <Row label="Segment" value={order.segment || "—"} />
            <Row label="Frozen (needs human)" value={order.needsHuman ? "YES" : "no"} />
            {order.items.length > 0 && (
              <div className="pt-2 border-t border-neutral-100">
                <div className="text-xs font-semibold text-neutral-500 mb-1">Cart (code-verified)</div>
                {order.items.map((i, idx) => (
                  <div key={idx} className="text-xs flex justify-between">
                    <span>
                      {i.qty}x {i.name}
                    </span>
                    <span>RM{(i.qty * i.unitPriceMyr).toLocaleString()}</span>
                  </div>
                ))}
                <div className="text-xs font-bold flex justify-between pt-1">
                  <span>Total</span>
                  <span>RM{order.totalMyr?.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="text-xs font-medium text-right">{value}</span>
    </div>
  );
}
