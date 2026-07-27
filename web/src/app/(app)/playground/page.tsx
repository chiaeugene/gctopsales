"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChatIcon, CheckIcon } from "@/components/ui/icons";

type Msg = { role: "CUSTOMER" | "GC" | "SYSTEM" | "AGENT"; content: string; attachmentIds?: string[] };
type Chat = {
  orderId: string;
  name: string | null;
  status: string;
  needsHuman: boolean;
  updatedAt: string;
  lastMessage: string | null;
};
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

// GC Workspace: one chat per real customer. The agent pastes the customer's
// incoming message here, GC replies, the agent copies the reply back into
// WhatsApp/IG/Messenger. Same production engine — just human-relayed until
// the channels are connected.
export default function PlaygroundPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<OrderState>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showChats, setShowChats] = useState(false); // mobile drawer
  const [showOrder, setShowOrder] = useState(false); // mobile order-state accordion
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<HTMLInputElement>(null);

  const loadChats = useCallback(async () => {
    const res = await fetch("/api/playground/session");
    if (!res.ok) return;
    const json = await res.json();
    setChats(json.chats ?? []);
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function openChat(id: string) {
    setError(null);
    setOrderId(id);
    setShowChats(false);
    setMessages([]);
    setOrder(null);
    const res = await fetch(`/api/playground/session?orderId=${id}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to load chat");
      return;
    }
    setMessages(
      (json.messages as Msg[]).filter((m) => m.role === "CUSTOMER" || m.role === "GC" || m.role === "AGENT")
    );
    setOrder(json.order);
  }

  async function createChat() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/playground/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to create chat");
        return;
      }
      setNewName("");
      await loadChats();
      await openChat(json.orderId);
    } finally {
      setCreating(false);
    }
  }

  async function renameChat(id: string) {
    const name = prompt("Customer name for this chat:");
    if (!name?.trim()) return;
    await fetch("/api/playground/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id, name: name.trim() }),
    });
    await loadChats();
  }

  async function deleteChat(id: string) {
    if (!confirm("Delete this chat and its history?")) return;
    await fetch("/api/playground/session", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id }),
    });
    if (orderId === id) {
      setOrderId(null);
      setMessages([]);
      setOrder(null);
    }
    await loadChats();
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy || !orderId) return;
    const text = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "CUSTOMER", content: text }]);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/playground/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, message: text }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Something went wrong");
        return;
      }
      if (json.reply) setMessages((m) => [...m, { role: "GC", content: json.reply, attachmentIds: json.attachmentIds }]);
      else if (json.needsHuman)
        setMessages((m) => [...m, { role: "SYSTEM", content: "(GC has frozen this chat for your review — reply to the customer yourself.)" }]);
      if (json.order) setOrder(json.order);
      loadChats();
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File, kind: "image" | "voice") {
    if (!orderId || busy) return;
    setBusy(true);
    setError(null);
    setMessages((m) => [
      ...m,
      { role: "CUSTOMER", content: kind === "image" ? `📷 [customer sent an image: ${file.name}]` : `🎤 [voice note: ${file.name}]` },
    ]);
    try {
      const form = new FormData();
      form.append("orderId", orderId);
      form.append("file", file);
      const res = await fetch(kind === "image" ? "/api/playground/inbound-image" : "/api/playground/inbound-voice", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Upload failed");
        return;
      }
      if (json.transcript) setMessages((m) => [...m, { role: "SYSTEM", content: `📝 Transcribed: "${json.transcript}"` }]);
      if (json.note) setMessages((m) => [...m, { role: "SYSTEM", content: json.note }]);
      const reply = json.reply || json.ackReply;
      if (reply) setMessages((m) => [...m, { role: "GC", content: reply, attachmentIds: json.attachmentIds }]);
      if (json.order) setOrder((o) => (o ? { ...o, ...json.order } : json.order));
    } finally {
      setBusy(false);
    }
  }

  const activeChat = chats.find((c) => c.orderId === orderId);

  const chatList = (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-black/[0.06] space-y-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") createChat();
          }}
          placeholder="New customer's name…"
          className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
        />
        <Button onClick={createChat} disabled={creating} className="w-full justify-center !py-2 !text-xs">
          {creating ? "Creating…" : "+ New customer chat"}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {chats.length === 0 && (
          <p className="text-xs text-black/35 p-3">No chats yet. Start one per customer you&apos;re talking to.</p>
        )}
        {chats.map((c) => (
          <div
            key={c.orderId}
            className={
              "group rounded-xl px-3 py-2 cursor-pointer transition-colors " +
              (c.orderId === orderId ? "bg-[var(--accent-soft)]" : "hover:bg-black/[0.03]")
            }
            onClick={() => openChat(c.orderId)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{c.name || "Unnamed customer"}</span>
              {c.needsHuman && <span className="shrink-0 text-[10px] font-bold text-red-600">YOU</span>}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-black/40 truncate">{c.lastMessage || c.status}</span>
              <span className="hidden group-hover:flex gap-1.5 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    renameChat(c.orderId);
                  }}
                  className="text-[10px] text-black/40 hover:text-[var(--accent-ink)]"
                >
                  Rename
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(c.orderId);
                  }}
                  className="text-[10px] text-black/40 hover:text-red-600"
                >
                  Delete
                </button>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 sm:gap-5 h-[calc(100dvh-8.5rem)] lg:h-[calc(100vh-6rem)]">
      <PageHeader
        title="GC Workspace"
        subtitle="One chat per customer. Paste what they sent you — GC writes the reply — copy it back to WhatsApp / IG / Messenger."
      />

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Chat list — desktop */}
        <Card padding="none" className="hidden md:flex w-60 shrink-0 flex-col">
          {chatList}
        </Card>

        {/* Chat column */}
        <Card padding="none" className="flex-1 flex flex-col min-w-0">
          <div className="px-3 sm:px-5 py-3 border-b border-black/[0.06] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                className="md:hidden rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium"
                onClick={() => setShowChats(true)}
              >
                Chats
              </button>
              <ChatIcon className="w-4 h-4 text-black/40 shrink-0 hidden sm:block" />
              <div className="font-semibold text-sm truncate">
                {activeChat ? activeChat.name || "Unnamed customer" : "Pick or start a chat"}
              </div>
            </div>
            {order && (
              <button
                className="xl:hidden rounded-lg border border-black/10 px-2.5 py-1.5 text-[11px] font-medium text-black/60"
                onClick={() => setShowOrder((v) => !v)}
              >
                {showOrder ? "Hide" : "Order"} {order.totalMyr ? `· RM${order.totalMyr.toLocaleString()}` : ""}
              </button>
            )}
          </div>

          {/* Mobile order-state accordion */}
          {showOrder && order && (
            <div className="xl:hidden border-b border-black/[0.06] px-4 py-3 bg-black/[0.02]">
              <OrderPanel order={order} compact />
            </div>
          )}

          {!orderId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-black/40 max-w-xs">
                Start a chat for each customer you&apos;re talking to. GC remembers every chat separately.
              </p>
              <Button onClick={() => (window.innerWidth < 768 ? setShowChats(true) : createChat())}>
                Start a customer chat
              </Button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
                {messages.length === 0 && (
                  <p className="text-sm text-black/35 text-center mt-10 px-4">
                    Paste the customer&apos;s first message below — exactly as they sent it, any language.
                  </p>
                )}
                {messages.map((m, i) => (
                  <MessageBubble key={i} msg={m} />
                ))}
                {busy && <div className="text-xs text-black/35">GC is typing…</div>}
                <div ref={bottomRef} />
              </div>

              {error && <div className="px-4 py-2 text-xs text-red-600 border-t border-black/[0.05]">{error}</div>}

              <form onSubmit={send} className="p-2.5 sm:p-3.5 border-t border-black/[0.06] flex gap-1.5 sm:gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f, "image");
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  title="Customer sent a photo (e.g. payment proof) — upload it here"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="rounded-xl border border-black/10 px-2.5 sm:px-3 text-xs font-medium text-black/60 hover:bg-black/[0.04] disabled:opacity-40"
                >
                  📷
                </button>
                <input
                  ref={voiceRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f, "voice");
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  title="Customer sent a voice note — upload the audio file"
                  onClick={() => voiceRef.current?.click()}
                  disabled={busy}
                  className="rounded-xl border border-black/10 px-2.5 sm:px-3 text-xs font-medium text-black/60 hover:bg-black/[0.04] disabled:opacity-40"
                >
                  🎤
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(e);
                    }
                  }}
                  rows={1}
                  placeholder="Paste the customer's message…"
                  className="flex-1 resize-none rounded-xl border border-black/10 px-3 sm:px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                />
                <Button type="submit" disabled={busy || !input.trim()}>
                  Send
                </Button>
              </form>
            </>
          )}
        </Card>

        {/* Order state — desktop */}
        <Card padding="md" className="hidden xl:block w-72 shrink-0 space-y-3 overflow-y-auto">
          <div className="font-semibold text-sm">Live order state</div>
          {!order && <p className="text-xs text-black/35">Updates as GC works the sale — status, cart, payment.</p>}
          {order && <OrderPanel order={order} />}
        </Card>
      </div>

      {/* Mobile chat drawer */}
      {showChats && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowChats(false)} />
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-xl flex flex-col">
            <div className="p-3 border-b border-black/[0.06] flex items-center justify-between">
              <span className="font-semibold text-sm">Customer chats</span>
              <button onClick={() => setShowChats(false)} className="text-xs text-black/40">
                Close
              </button>
            </div>
            <div className="flex-1 min-h-0">{chatList}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const [copied, setCopied] = useState(false);
  if (msg.role === "SYSTEM") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] sm:max-w-[85%] rounded-xl bg-[var(--hot-soft)] text-[var(--hot)] px-3.5 py-2.5 text-xs whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }
  const isCustomer = msg.role === "CUSTOMER";
  return (
    <div className={isCustomer ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isCustomer
            ? "max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-md bg-[var(--ink)] text-white px-3.5 sm:px-4 py-2.5 text-sm whitespace-pre-wrap"
            : "max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-bl-md bg-black/[0.04] px-3.5 sm:px-4 py-2.5 text-sm whitespace-pre-wrap"
        }
      >
        {msg.content}
        {msg.attachmentIds && msg.attachmentIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {msg.attachmentIds.map((aid) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={aid} src={`/api/attachments/${aid}`} alt="attachment GC sent" className="rounded-lg max-h-40 border border-black/[0.06]" />
            ))}
          </div>
        )}
        {!isCustomer && (
          <div className="mt-1.5 -mb-0.5">
            <button
              onClick={() => {
                navigator.clipboard.writeText(msg.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-ink)] hover:underline"
              title="Copy GC's reply, then paste it to the customer"
            >
              {copied ? (
                <>
                  <CheckIcon className="w-3 h-3" /> Copied — paste to customer
                </>
              ) : (
                "Copy reply"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderPanel({ order, compact }: { order: NonNullable<OrderState>; compact?: boolean }) {
  return (
    <div className={"space-y-2 text-sm " + (compact ? "text-xs" : "")}>
      <Row label="Status" value={order.status} />
      <Row label="Payment" value={order.paymentStatus} />
      <Row label="Customer" value={order.customerName || "—"} />
      <Row label="Segment" value={order.segment || "—"} />
      <Row label="Needs you" value={order.needsHuman ? "YES" : "no"} />
      {order.items.length > 0 && (
        <div className="pt-2 border-t border-black/[0.06]">
          <div className="text-xs font-semibold text-black/45 mb-1">Cart (code-verified)</div>
          {order.items.map((i, idx) => (
            <div key={idx} className="text-xs flex justify-between">
              <span>
                {i.qty}x {i.name}
              </span>
              <span className="tabular-nums">RM{(i.qty * i.unitPriceMyr).toLocaleString()}</span>
            </div>
          ))}
          <div className="text-xs font-bold flex justify-between pt-1">
            <span>Total</span>
            <span className="tabular-nums">RM{order.totalMyr?.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs text-black/45">{label}</span>
      <span className="text-xs font-medium text-right">{value}</span>
    </div>
  );
}
