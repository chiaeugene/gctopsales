"use client";

import { use, useCallback, useEffect, useState } from "react";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/constants";

type OrderDetail = {
  id: string;
  source: string;
  customerName: string | null;
  phone: string | null;
  deliveryAddress: string | null;
  segment: string | null;
  productInterest: string | null;
  items: { name: string; qty: number; unitPriceMyr: number }[];
  totalMyr: number | null;
  status: string;
  paymentStatus: string;
  trackingNumber: string | null;
  summary: string | null;
  nextAction: string | null;
  needsHuman: boolean;
  takeoverReason: string | null;
  salesReport: SalesReport | null;
};
type SalesReport = {
  scores: { discovery: number; uspMatch: number; objectionHandling: number; closing: number };
  overall: number;
  outcome: string;
  lostReason: string | null;
  whatWentWell: string;
  coachingTip: string;
};
type Msg = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  inboundAttachments: { id: string; url: string; mimeType: string }[];
};

export default function OrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [agentMessage, setAgentMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/orders/${id}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to load");
      return;
    }
    setOrder(json.order);
    setMessages(json.messages);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) setError((await res.json()).error || "Update failed");
      await load();
    } finally {
      setBusy(false);
    }
  }

  const [grading, setGrading] = useState(false);
  async function gradeNow() {
    setGrading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${id}/report`, { method: "POST" });
      if (!res.ok) setError((await res.json()).error || "Grading failed");
      await load();
    } finally {
      setGrading(false);
    }
  }

  async function takeover(action: "take" | "release") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${id}/takeover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(action === "take" && agentMessage.trim() ? { message: agentMessage.trim() } : {}) }),
      });
      if (!res.ok) setError((await res.json()).error || "Action failed");
      setAgentMessage("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!order) return <div className="text-sm text-neutral-400">{error || "Loading…"}</div>;

  return (
    <div className="flex gap-6 h-[calc(100vh-6rem)]">
      {/* Conversation */}
      <div className="flex-1 min-w-0 flex flex-col rounded-xl bg-white border border-neutral-200">
        <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">
              {order.customerName || "Customer"} <span className="text-xs text-neutral-400">({order.source})</span>
            </div>
            {order.needsHuman && (
              <div className="text-xs text-amber-600 font-medium">⚠ Frozen for you: {order.takeoverReason}</div>
            )}
          </div>
          <div className="flex gap-2">
            {order.needsHuman ? (
              <button
                onClick={() => takeover("release")}
                disabled={busy}
                className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                Hand back to GC
              </button>
            ) : (
              <button
                onClick={() => takeover("take")}
                disabled={busy}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
              >
                Take over
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={m.role === "CUSTOMER" ? "flex justify-start" : "flex justify-end"}>
              <div
                className={
                  m.role === "CUSTOMER"
                    ? "max-w-[75%] rounded-2xl rounded-bl-sm bg-neutral-100 px-4 py-2 text-sm whitespace-pre-wrap"
                    : m.role === "SYSTEM"
                      ? "max-w-[85%] rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-xs"
                      : "max-w-[75%] rounded-2xl rounded-br-sm bg-violet-600 text-white px-4 py-2 text-sm whitespace-pre-wrap"
                }
              >
                {m.role !== "CUSTOMER" && m.role !== "SYSTEM" && (
                  <div className="text-[10px] opacity-70 mb-0.5">{m.role === "AGENT" ? "You" : "GC"}</div>
                )}
                {m.content}
                {m.inboundAttachments.map((a) =>
                  a.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={a.id} src={a.url} alt="customer attachment" className="mt-2 rounded-lg max-h-64" />
                  ) : a.mimeType.startsWith("audio/") ? (
                    <audio key={a.id} src={a.url} controls className="mt-2 w-full max-w-xs" />
                  ) : null
                )}
              </div>
            </div>
          ))}
        </div>

        {order.needsHuman && (
          <div className="p-3 border-t border-neutral-200 flex gap-2">
            <input
              value={agentMessage}
              onChange={(e) => setAgentMessage(e.target.value)}
              placeholder="Reply as yourself (sent to the customer's channel)…"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              onClick={() => takeover("take")}
              disabled={busy || !agentMessage.trim()}
              className="rounded-lg bg-violet-700 text-white px-4 py-2 text-sm font-semibold hover:bg-violet-800 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        )}
      </div>

      {/* Order panel */}
      <aside className="w-80 shrink-0 rounded-xl bg-white border border-neutral-200 p-4 space-y-4 overflow-y-auto">
        {error && <div className="text-xs text-red-600">{error}</div>}

        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Order</h2>
          <label className="block text-xs">
            <span className="text-neutral-500">Status</span>
            <select
              value={order.status}
              disabled={busy}
              onChange={(e) => patch({ status: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-neutral-500">Payment status (money choke-point)</span>
            <select
              value={order.paymentStatus}
              disabled={busy}
              onChange={(e) => patch({ paymentStatus: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            >
              {PAYMENT_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {order.items.length > 0 && (
            <div className="rounded-lg bg-neutral-50 p-2 text-xs space-y-1">
              {order.items.map((i, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>
                    {i.qty}x {i.name}
                  </span>
                  <span>RM{(i.qty * i.unitPriceMyr).toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t border-neutral-200 pt-1">
                <span>Total</span>
                <span>RM{order.totalMyr?.toLocaleString()}</span>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Customer</h2>
          <EditableField label="Name" value={order.customerName} onSave={(v) => patch({ customerName: v })} />
          <EditableField label="Phone" value={order.phone} onSave={(v) => patch({ phone: v })} />
          <EditableField label="Delivery address" value={order.deliveryAddress} onSave={(v) => patch({ deliveryAddress: v })} multiline />
          <EditableField label="Tracking number" value={order.trackingNumber} onSave={(v) => patch({ trackingNumber: v })} />
        </section>

        {(order.summary || order.nextAction) && (
          <section className="space-y-1">
            <h2 className="font-semibold text-sm">GC's notes</h2>
            {order.summary && <p className="text-xs text-neutral-600">{order.summary}</p>}
            {order.nextAction && <p className="text-xs text-violet-700 font-medium">Next: {order.nextAction}</p>}
          </section>
        )}

        {/* Sales report card */}
        <section className="space-y-2 border-t border-neutral-100 pt-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Sales report card</h2>
            <button onClick={gradeNow} disabled={grading} className="text-xs text-violet-700 hover:underline disabled:opacity-50">
              {grading ? "Grading…" : order.salesReport ? "Re-grade" : "Grade this"}
            </button>
          </div>
          {!order.salesReport && <p className="text-xs text-neutral-400">Grade the conversation to see how it was sold (auto-runs when won or lost).</p>}
          {order.salesReport && (
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-violet-700">{order.salesReport.overall}</span>
                <span className="text-xs text-neutral-500">/100 · {order.salesReport.outcome}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <ScoreBar label="Discovery" v={order.salesReport.scores.discovery} />
                <ScoreBar label="USP match" v={order.salesReport.scores.uspMatch} />
                <ScoreBar label="Objections" v={order.salesReport.scores.objectionHandling} />
                <ScoreBar label="Closing" v={order.salesReport.scores.closing} />
              </div>
              {order.salesReport.whatWentWell && <p className="text-xs text-emerald-700">✓ {order.salesReport.whatWentWell}</p>}
              {order.salesReport.coachingTip && <p className="text-xs text-amber-700">💡 {order.salesReport.coachingTip}</p>}
              {order.salesReport.lostReason && <p className="text-xs text-red-600">Lost: {order.salesReport.lostReason}</p>}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

function ScoreBar({ label, v }: { label: string; v: number }) {
  const color = v >= 7 ? "bg-emerald-500" : v >= 4 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-neutral-500">
        <span>{label}</span>
        <span>{v}/10</span>
      </div>
      <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${v * 10}%` }} />
      </div>
    </div>
  );
}

function EditableField(props: {
  label: string;
  value: string | null;
  onSave: (v: string) => void;
  multiline?: boolean;
}) {
  const [val, setVal] = useState(props.value ?? "");
  useEffect(() => setVal(props.value ?? ""), [props.value]);
  const dirty = val !== (props.value ?? "");
  return (
    <label className="block text-xs">
      <span className="text-neutral-500">{props.label}</span>
      <div className="flex gap-1 mt-1">
        {props.multiline ? (
          <textarea value={val} onChange={(e) => setVal(e.target.value)} rows={2} className="flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
        ) : (
          <input value={val} onChange={(e) => setVal(e.target.value)} className="flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
        )}
        {dirty && (
          <button onClick={() => props.onSave(val)} className="rounded-lg bg-violet-700 text-white px-2 text-xs font-semibold">
            ✓
          </button>
        )}
      </div>
    </label>
  );
}
