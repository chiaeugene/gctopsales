"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChatIcon, CheckIcon } from "@/components/ui/icons";
import { useT } from "@/components/I18nProvider";
import { splitIntoBubbles } from "@/lib/ai/humanize";

// A chat is "quiet" once nothing has happened for a day — surface it so the
// agent knows who to nudge.
function quietDays(updatedAt: string): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000);
}

type Msg = { id?: string; role: "CUSTOMER" | "GC" | "SYSTEM" | "AGENT"; content: string; attachmentIds?: string[] };
type Chat = {
  orderId: string;
  name: string | null;
  status: string;
  needsHuman: boolean;
  updatedAt: string;
  lastMessage: string | null;
  source: string;
};

// A live channel chat is a real customer on WhatsApp/IG/Messenger; PLAYGROUND
// chats are the agent's own practice/copy-paste threads.
const isLive = (source?: string) => Boolean(source) && source !== "PLAYGROUND";
const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  MESSENGER: "Messenger",
  INSTAGRAM: "Instagram",
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
  leadSource?: string | null;
  source?: string;
  externalContactId?: string | null;
} | null;

const LEAD_SOURCES = ["WhatsApp", "Instagram", "Facebook", "TikTok", "Referral", "Walk-in", "Ads", "Other"];

// GC Workspace: one chat per real customer. The agent pastes the customer's
// incoming message here, GC replies, the agent copies the reply back into
// WhatsApp/IG/Messenger. Same production engine — just human-relayed until
// the channels are connected.
export default function PlaygroundPage() {
  const { t } = useT();
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

  // Silently re-read the open conversation. Only swaps state when something
  // actually changed, so the view doesn't flicker or fight the scroll position.
  const refreshOpenChat = useCallback(async () => {
    if (!orderId) return;
    const res = await fetch(`/api/playground/session?orderId=${orderId}`);
    if (!res.ok) return;
    const json = await res.json();
    const next = (json.messages as Msg[]).filter(
      (m) => m.role === "CUSTOMER" || m.role === "GC" || m.role === "AGENT"
    );
    setMessages((prev) => {
      const unchanged =
        prev.length === next.length && prev[prev.length - 1]?.content === next[next.length - 1]?.content;
      return unchanged ? prev : next;
    });
    setOrder((prev) => (JSON.stringify(prev) === JSON.stringify(json.order) ? prev : json.order));
  }, [orderId]);

  // Live inbox: real customers arrive on their own schedule, so poll instead of
  // making the agent press refresh. Paused while a tab is hidden or a request
  // of ours is already in flight.
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (busy) return;
      loadChats();
      refreshOpenChat();
    }, 4000);
    return () => clearInterval(timer);
  }, [busy, loadChats, refreshOpenChat]);

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

  // Remove a message from GC's memory of this conversation. GC re-reads recent
  // history before every reply, so pulling a bad exchange stops it influencing
  // the next answers. It does NOT unsend anything already on WhatsApp.
  async function deleteMessage(id: string) {
    if (
      !confirm(
        "Remove this message from GC's memory?\n\nGC will no longer use it when writing future replies. If it was already delivered on WhatsApp, the customer still has their copy — delete it in WhatsApp too if you need that."
      )
    )
      return;
    const res = await fetch("/api/messages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      setError((await res.json()).error || "Could not remove the message");
      return;
    }
    setMessages((m) => m.filter((x) => x.id !== id));
    loadChats();
  }

  // On a LIVE channel chat the agent is talking to a real customer, so typing
  // must deliver to them (and pause GC), not simulate a customer message.
  async function sendAsAgent(text: string) {
    if (!orderId) return;
    setMessages((m) => [...m, { role: "AGENT", content: text }]);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/takeover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "take", message: text }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not send to the customer");
        return;
      }
      setOrder((o) => (o ? { ...o, needsHuman: true } : o));
      loadChats();
    } finally {
      setBusy(false);
    }
  }

  // Hand the conversation back to GC; it answers any unreplied customer message.
  async function handBackToGc() {
    if (!orderId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/takeover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not hand back");
        return;
      }
      if (json.reply) setMessages((m) => [...m, { role: "GC", content: json.reply }]);
      setOrder((o) => (o ? { ...o, needsHuman: false } : o));
      loadChats();
    } finally {
      setBusy(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy || !orderId) return;
    const text = input.trim();
    setInput("");
    if (isLive(order?.source ?? activeChat?.source)) {
      await sendAsAgent(text);
      return;
    }
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

  // Inline header rename — the name is editable any time, not just at creation.
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  async function saveName() {
    setEditingName(false);
    const name = nameDraft.trim();
    if (!orderId || !name) return;
    setOrder((o) => (o ? { ...o, customerName: name } : o));
    await fetch("/api/playground/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, name }),
    });
    loadChats();
  }

  async function saveLeadSource(leadSource: string) {
    if (!orderId) return;
    setOrder((o) => (o ? { ...o, leadSource: leadSource || null } : o));
    await fetch("/api/playground/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, leadSource: leadSource || null }),
    });
  }

  async function suggestFollowUp() {
    if (!orderId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/playground/suggest-follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Something went wrong");
        return;
      }
      setMessages((m) => [...m, { role: "GC", content: json.reply, attachmentIds: json.attachmentIds }]);
      loadChats();
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
          placeholder={t("ws.newChatName")}
          className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
        />
        <Button onClick={createChat} disabled={creating} className="w-full justify-center !py-2 !text-xs">
          {creating ? t("ws.creating") : t("ws.newChat")}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {chats.length === 0 && <p className="text-xs text-black/35 p-3">{t("ws.noChats")}</p>}
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
              <span className="text-sm font-medium truncate flex items-center gap-1.5 min-w-0">
                {isLive(c.source) && (
                  <span
                    className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500"
                    title={`Live on ${CHANNEL_LABEL[c.source] ?? c.source}`}
                  />
                )}
                <span className="truncate">{c.name || t("ws.unnamed")}</span>
              </span>
              <span className="shrink-0 flex items-center gap-1.5">
                {quietDays(c.updatedAt) >= 1 && !c.needsHuman && (
                  <span className="text-[10px] font-semibold text-amber-600">
                    {quietDays(c.updatedAt)}
                    {t("ws.quietDays")}
                  </span>
                )}
                {c.needsHuman && <span className="text-[10px] font-bold text-red-600">YOU</span>}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-black/40 truncate">
                {isLive(c.source) && (
                  <span className="text-emerald-700 font-medium">{CHANNEL_LABEL[c.source] ?? c.source} · </span>
                )}
                {c.lastMessage || c.status}
              </span>
              <span className="hidden group-hover:flex gap-1.5 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    renameChat(c.orderId);
                  }}
                  className="text-[10px] text-black/40 hover:text-[var(--accent-ink)]"
                >
                  {t("ws.rename")}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(c.orderId);
                  }}
                  className="text-[10px] text-black/40 hover:text-red-600"
                >
                  {t("ws.delete")}
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
      <PageHeader title={t("ws.title")} subtitle={t("ws.subtitle")} />

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
                {t("ws.chats")}
              </button>
              <ChatIcon className="w-4 h-4 text-black/40 shrink-0 hidden sm:block" />
              {orderId && editingName ? (
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  className="font-semibold text-sm rounded-lg border border-[var(--accent)] px-2 py-1 outline-none min-w-0 w-40"
                />
              ) : (
                <button
                  className="font-semibold text-sm truncate text-left group/name inline-flex items-center gap-1.5 min-w-0"
                  onClick={() => {
                    if (!orderId) return;
                    setNameDraft(order?.customerName || activeChat?.name || "");
                    setEditingName(true);
                  }}
                  title={orderId ? "Click to edit the customer's name" : undefined}
                >
                  <span className="truncate">
                    {activeChat ? order?.customerName || activeChat.name || t("ws.unnamed") : t("ws.pickChat")}
                  </span>
                  {orderId && <span className="text-[10px] text-black/30 group-hover/name:text-[var(--accent-ink)]">✎</span>}
                </button>
              )}
            </div>
            {orderId && !order?.needsHuman && (
              <button
                onClick={suggestFollowUp}
                disabled={busy}
                title="GC drafts a follow-up nudge for this customer — copy it and send"
                className="shrink-0 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--accent-ink)] hover:bg-[var(--accent-soft-2)] disabled:opacity-40"
              >
                {busy ? t("ws.suggesting") : t("ws.suggestFollowUp")}
              </button>
            )}
            {order && (
              <button
                className="xl:hidden rounded-lg border border-black/10 px-2.5 py-1.5 text-[11px] font-medium text-black/60"
                onClick={() => setShowOrder((v) => !v)}
              >
                {showOrder ? "Hide" : "Order"} {order.totalMyr ? `· RM${order.totalMyr.toLocaleString()}` : ""}
              </button>
            )}
          </div>

          {/* Live-channel banner: this is a real customer, GC is autonomous */}
          {orderId && isLive(order?.source ?? activeChat?.source) && (
            <div className="border-b border-emerald-200 bg-emerald-50/70 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-emerald-900 flex items-center gap-1.5 flex-wrap">
                <span className="relative flex w-2 h-2 shrink-0" title="Updating automatically">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
                </span>
                <strong>Live on {CHANNEL_LABEL[(order?.source ?? activeChat?.source) as string] ?? "channel"}</strong>
                {order?.externalContactId ? ` · ${order.externalContactId}` : ""}
                {" — "}
                {order?.needsHuman
                  ? "you are handling this chat, GC is paused."
                  : "GC is replying automatically. Anything you type goes to the customer and pauses GC."}
              </span>
              {order?.needsHuman && (
                <button
                  onClick={handBackToGc}
                  disabled={busy}
                  className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  Let GC take over again
                </button>
              )}
            </div>
          )}

          {/* Mobile order-state accordion */}
          {showOrder && order && (
            <div className="xl:hidden border-b border-black/[0.06] px-4 py-3 bg-black/[0.02]">
              <OrderPanel order={order} compact onLeadSource={saveLeadSource} />
            </div>
          )}

          {!orderId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-black/40 max-w-xs">{t("ws.startHint")}</p>
              <Button onClick={() => (window.innerWidth < 768 ? setShowChats(true) : createChat())}>
                {t("ws.startChat")}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
                {messages.length === 0 && (
                  <p className="text-sm text-black/35 text-center mt-10 px-4">{t("ws.firstMessageHint")}</p>
                )}
                {messages.map((m, i) => (
                  <MessageBubble
                    key={m.id ?? i}
                    msg={m}
                    live={isLive(order?.source ?? activeChat?.source)}
                    onDelete={m.id ? () => deleteMessage(m.id!) : undefined}
                  />
                ))}
                {busy && <div className="text-xs text-black/35">{t("ws.typing")}</div>}
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
                {!isLive(order?.source ?? activeChat?.source) && (
                <button
                  type="button"
                  title="Customer sent a photo (e.g. payment proof) — upload it here"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="rounded-xl border border-black/10 px-2.5 sm:px-3 text-xs font-medium text-black/60 hover:bg-black/[0.04] disabled:opacity-40"
                >
                  📷
                </button>
                )}
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
                {!isLive(order?.source ?? activeChat?.source) && (
                <button
                  type="button"
                  title="Customer sent a voice note — upload the audio file"
                  onClick={() => voiceRef.current?.click()}
                  disabled={busy}
                  className="rounded-xl border border-black/10 px-2.5 sm:px-3 text-xs font-medium text-black/60 hover:bg-black/[0.04] disabled:opacity-40"
                >
                  🎤
                </button>
                )}
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
                  placeholder={
                    isLive(order?.source ?? activeChat?.source)
                      ? "Type a message to send to this customer…"
                      : t("ws.pasteMessage")
                  }
                  className="flex-1 resize-none rounded-xl border border-black/10 px-3 sm:px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                />
                <Button type="submit" disabled={busy || !input.trim()}>
                  {t("ws.send")}
                </Button>
              </form>
            </>
          )}
        </Card>

        {/* Order state — desktop */}
        <Card padding="md" className="hidden xl:block w-72 shrink-0 space-y-3 overflow-y-auto">
          <div className="font-semibold text-sm">{t("ws.orderState")}</div>
          {!order && <p className="text-xs text-black/35">{t("ws.orderStateHint")}</p>}
          {order && <OrderPanel order={order} onLeadSource={saveLeadSource} />}
        </Card>
      </div>

      {/* Mobile chat drawer */}
      {showChats && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowChats(false)} />
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-xl flex flex-col">
            <div className="p-3 border-b border-black/[0.06] flex items-center justify-between">
              <span className="font-semibold text-sm">{t("ws.customerChats")}</span>
              <button onClick={() => setShowChats(false)} className="text-xs text-black/40">
                {t("ws.close")}
              </button>
            </div>
            <div className="flex-1 min-h-0">{chatList}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, live, onDelete }: { msg: Msg; live?: boolean; onDelete?: () => void }) {
  const { t } = useT();
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

  // GC's reply goes out as several separate WhatsApp messages (blank lines are
  // bubble breaks), so show it here the way the customer actually receives it —
  // same splitter as the senders, so this can never drift from reality.
  const parts = msg.role === "GC" ? splitIntoBubbles(msg.content) : [msg.content];
  const lastIdx = parts.length - 1;

  return (
    <div className="space-y-1.5">
      {parts.map((part, idx) => {
        const isLast = idx === lastIdx;
        return (
          <div key={idx} className={"group/msg " + (isCustomer ? "flex justify-end" : "flex justify-start")}>
            <div
              className={
                isCustomer
                  ? "max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-md bg-[var(--ink)] text-white px-3.5 sm:px-4 py-2.5 text-sm whitespace-pre-wrap"
                  : "max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-bl-md bg-black/[0.04] px-3.5 sm:px-4 py-2.5 text-sm whitespace-pre-wrap"
              }
            >
              {msg.role === "AGENT" && idx === 0 && <div className="text-[10px] text-black/35 mb-0.5">You</div>}
              {/* Delete removes the whole stored reply, so it belongs on the
                  first bubble only — one × per actual message. */}
              {onDelete && idx === 0 && (
                <button
                  onClick={onDelete}
                  title="Remove this message from GC's memory"
                  className={
                    "float-right ml-2 -mr-1 -mt-0.5 text-[13px] leading-none opacity-0 group-hover/msg:opacity-60 hover:!opacity-100 transition-opacity " +
                    (isCustomer ? "text-white" : "text-black/50")
                  }
                >
                  ×
                </button>
              )}
              {part}
              {isLast && msg.attachmentIds && msg.attachmentIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {msg.attachmentIds.map((aid) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={aid} src={`/api/attachments/${aid}`} alt="attachment GC sent" className="rounded-lg max-h-40 border border-black/[0.06]" />
                  ))}
                </div>
              )}
              {/* On a live channel GC already delivered this to the customer, so
                  there is nothing to copy — say so instead. */}
              {isLast && !isCustomer && msg.role === "GC" && live && (
                <div className="mt-1.5 -mb-0.5 text-[11px] text-emerald-700">
                  ✓ sent to customer automatically
                  {parts.length > 1 && <span className="text-black/35"> · {parts.length} messages</span>}
                </div>
              )}
              {isLast && !isCustomer && !(msg.role === "GC" && live) && msg.role !== "AGENT" && (
                <div className="mt-1.5 -mb-0.5">
                  <button
                    onClick={() => {
                      // Copy the whole reply, blank lines intact, so pasting it
                      // by hand reproduces the same separate messages.
                      navigator.clipboard.writeText(msg.content);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-ink)] hover:underline"
                    title="Copy GC's reply, then paste it to the customer"
                  >
                    {copied ? (
                      <>
                        <CheckIcon className="w-3 h-3" /> {t("ws.copied")}
                      </>
                    ) : (
                      t("ws.copyReply")
                    )}
                  </button>
                  {parts.length > 1 && (
                    <span className="ml-2 text-[11px] text-black/35">sends as {parts.length} messages</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrderPanel({
  order,
  compact,
  onLeadSource,
}: {
  order: NonNullable<OrderState>;
  compact?: boolean;
  onLeadSource?: (v: string) => void;
}) {
  return (
    <div className={"space-y-2 text-sm " + (compact ? "text-xs" : "")}>
      <Row label="Status" value={order.status} />
      <Row label="Payment" value={order.paymentStatus} />
      <Row label="Customer" value={order.customerName || "—"} />
      <Row label="Segment" value={order.segment || "—"} />
      {onLeadSource && (
        <div className="flex justify-between items-center gap-2">
          <span className="text-xs text-black/45">Lead from</span>
          <select
            value={order.leadSource ?? ""}
            onChange={(e) => onLeadSource(e.target.value)}
            className="text-xs rounded-lg border border-black/10 bg-white/80 px-2 py-1 outline-none focus:border-[var(--accent)]"
          >
            <option value="">— pick —</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}
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
