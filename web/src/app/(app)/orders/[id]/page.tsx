"use client";

import { use, useCallback, useEffect, useState } from "react";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/constants";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AlertIcon, CheckIcon } from "@/components/ui/icons";

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

  if (!order) return <div className="text-sm text-black/40">{error || "Loading…"}</div>;

  return (
    <div className="flex gap-6 h-[calc(100vh-6rem)]">
      {/* Conversation */}
      <Card padding="none" className="flex-1 min-w-0 flex flex-col">
        <div className="px-4 py-3 border-b border-black/[0.06] flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">
              {order.customerName || "Customer"} <span className="text-xs text-black/40">({order.source})</span>
            </div>
            {order.needsHuman && (
              <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                <AlertIcon className="w-3.5 h-3.5" /> Frozen for you: {order.takeoverReason}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {order.needsHuman ? (
              <Button variant="primary" onClick={() => takeover("release")} disabled={busy}>
                Hand back to GC
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => takeover("take")} disabled={busy}>
                Take over
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={m.role === "CUSTOMER" ? "flex justify-start" : "flex justify-end"}>
              <div
                className={
                  m.role === "CUSTOMER"
                    ? "max-w-[75%] rounded-2xl rounded-bl-sm bg-black/[0.04] px-4 py-2 text-sm whitespace-pre-wrap"
                    : m.role === "SYSTEM"
                      ? "max-w-[85%] rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-xs"
                      : "max-w-[75%] rounded-2xl rounded-br-sm bg-[var(--ink)] text-white px-4 py-2 text-sm whitespace-pre-wrap"
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
          <div className="p-3 border-t border-black/[0.06] flex gap-2">
            <input
              value={agentMessage}
              onChange={(e) => setAgentMessage(e.target.value)}
              placeholder="Reply as yourself (sent to the customer's channel)…"
              className="flex-1 rounded-lg border border-black/[0.1] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <Button variant="primary" onClick={() => takeover("take")} disabled={busy || !agentMessage.trim()}>
              Send
            </Button>
          </div>
        )}
      </Card>

      {/* Order panel */}
      <aside className="w-80 shrink-0 overflow-y-auto">
        <Card className="space-y-4">
          {error && <div className="text-xs text-red-600">{error}</div>}

          <section className="space-y-2">
            <h2 className="font-semibold text-sm">Order</h2>
            <label className="block text-xs">
              <span className="text-black/45">Status</span>
              <select
                value={order.status}
                disabled={busy}
                onChange={(e) => patch({ status: e.target.value })}
                className="mt-1 w-full rounded-lg border border-black/[0.1] px-2 py-1.5 text-sm"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="text-black/45">Payment status (money choke-point)</span>
              <select
                value={order.paymentStatus}
                disabled={busy}
                onChange={(e) => patch({ paymentStatus: e.target.value })}
                className="mt-1 w-full rounded-lg border border-black/[0.1] px-2 py-1.5 text-sm"
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {order.items.length > 0 && (
              <div className="rounded-lg bg-black/[0.03] p-2 text-xs space-y-1">
                {order.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {i.qty}x {i.name}
                    </span>
                    <span className="tabular-nums">RM{(i.qty * i.unitPriceMyr).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold border-t border-black/[0.06] pt-1">
                  <span>Total</span>
                  <span className="tabular-nums">RM{order.totalMyr?.toLocaleString()}</span>
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
              <h2 className="font-semibold text-sm">GC&apos;s notes</h2>
              {order.summary && <p className="text-xs text-black/60">{order.summary}</p>}
              {order.nextAction && <p className="text-xs text-[var(--accent-ink)] font-medium">Next: {order.nextAction}</p>}
            </section>
          )}

          {/* Sales report card */}
          <section className="space-y-2 border-t border-black/[0.06] pt-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Sales report card</h2>
              <button onClick={gradeNow} disabled={grading} className="text-xs text-[var(--accent-ink)] hover:underline disabled:opacity-50">
                {grading ? "Grading…" : order.salesReport ? "Re-grade" : "Grade this"}
              </button>
            </div>
            {!order.salesReport && <p className="text-xs text-black/35">Grade the conversation to see how it was sold (auto-runs when won or lost).</p>}
            {order.salesReport && (
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tracking-tight text-[var(--accent-ink)] tabular-nums">{order.salesReport.overall}</span>
                  <span className="text-xs text-black/45">/100 · {order.salesReport.outcome}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <ScoreBar label="Discovery" v={order.salesReport.scores.discovery} />
                  <ScoreBar label="USP match" v={order.salesReport.scores.uspMatch} />
                  <ScoreBar label="Objections" v={order.salesReport.scores.objectionHandling} />
                  <ScoreBar label="Closing" v={order.salesReport.scores.closing} />
                </div>
                {order.salesReport.whatWentWell && (
                  <p className="flex items-start gap-1 text-xs text-emerald-700">
                    <CheckIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {order.salesReport.whatWentWell}
                  </p>
                )}
                {order.salesReport.coachingTip && <p className="text-xs text-amber-700">Tip: {order.salesReport.coachingTip}</p>}
                {order.salesReport.lostReason && <p className="text-xs text-red-600">Lost: {order.salesReport.lostReason}</p>}
              </div>
            )}
          </section>
        </Card>
      </aside>
    </div>
  );
}

function ScoreBar({ label, v }: { label: string; v: number }) {
  const color = v >= 7 ? "bg-emerald-500" : v >= 4 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-black/45">
        <span>{label}</span>
        <span className="tabular-nums">{v}/10</span>
      </div>
      <div className="h-1.5 rounded-full bg-black/[0.05] overflow-hidden">
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
      <span className="text-black/45">{props.label}</span>
      <div className="flex gap-1 mt-1">
        {props.multiline ? (
          <textarea value={val} onChange={(e) => setVal(e.target.value)} rows={2} className="flex-1 rounded-lg border border-black/[0.1] px-2 py-1.5 text-sm" />
        ) : (
          <input value={val} onChange={(e) => setVal(e.target.value)} className="flex-1 rounded-lg border border-black/[0.1] px-2 py-1.5 text-sm" />
        )}
        {dirty && (
          <button onClick={() => props.onSave(val)} className="rounded-lg bg-[var(--ink)] text-white px-2 text-xs font-semibold hover:bg-[var(--accent-ink)] transition-colors">
            <CheckIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </label>
  );
}
