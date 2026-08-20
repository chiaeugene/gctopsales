"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { CheckIcon, AlertIcon } from "@/components/ui/icons";

/**
 * The rollout watcher.
 *
 * The funnel comes first because it answers the question that matters during a
 * rollout — where is each person stuck — and the feed below answers "what just
 * happened". Stages are ordered the way they gate selling, so the first empty
 * cell on a row IS that agent's next conversation with you.
 */
type Row = {
  profileId: string;
  name: string;
  email: string;
  leaderName: string | null;
  isAdmin: boolean;
  lastLogin: string | null;
  setupStarted: boolean;
  trainingCount: number;
  paymentReady: boolean;
  whatsappConnected: boolean;
  connectFailures: number;
  practiceReplies: number;
  liveReplies: number;
};
type Event = { id: string; at: string; type: string; summary: string; ok: boolean; who: string };

const STAGES = [
  { key: "lastLogin", label: "Signed in" },
  { key: "setupStarted", label: "Set up" },
  { key: "trainingCount", label: "Trained" },
  { key: "paymentReady", label: "Bank details" },
  { key: "whatsappConnected", label: "WhatsApp" },
  { key: "liveReplies", label: "Real customer" },
] as const;

function reached(r: Row, key: (typeof STAGES)[number]["key"]): boolean {
  const v = r[key];
  return typeof v === "number" ? v > 0 : Boolean(v);
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function ActivityPage() {
  const [funnel, setFunnel] = useState<Row[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/activity");
    if (!res.ok) return;
    const json = await res.json();
    setFunnel(json.funnel ?? []);
    setEvents(json.events ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    // A rollout is watched live, on the day. Thirty seconds is often enough to
    // catch somebody stuck while they are still sitting at their phone.
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const agents = funnel.filter((r) => !r.isAdmin);
  const connected = agents.filter((r) => r.whatsappConnected).length;
  const selling = agents.filter((r) => r.liveReplies > 0).length;
  const neverLoggedIn = agents.filter((r) => !r.lastLogin);
  const stuckOnConnect = agents.filter((r) => r.connectFailures > 0 && !r.whatsappConnected);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        subtitle="Who signed in, who set up, who connected WhatsApp, and who is answering real customers. Refreshes every 30 seconds."
      />

      {loaded && agents.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Enrolled", value: agents.length },
            { label: "WhatsApp connected", value: connected },
            { label: "Answering customers", value: selling },
          ].map((s) => (
            <Card key={s.label}>
              <p className="text-xs text-black/45">{s.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* The two lists worth acting on today, named rather than left to be spotted. */}
      {(neverLoggedIn.length > 0 || stuckOnConnect.length > 0) && (
        <Card className="!border-amber-200 !bg-amber-50 space-y-1.5">
          <h2 className="font-semibold text-sm text-amber-900">Worth a message today</h2>
          {stuckOnConnect.length > 0 && (
            <p className="text-sm text-amber-900/80">
              <strong>Tried to connect WhatsApp and it failed:</strong>{" "}
              {stuckOnConnect.map((r) => r.name).join(", ")}. They will not tell you, and they cannot sell until it
              works.
            </p>
          )}
          {neverLoggedIn.length > 0 && (
            <p className="text-sm text-amber-900/80">
              <strong>Never signed in:</strong> {neverLoggedIn.map((r) => r.name).join(", ")}.
            </p>
          )}
        </Card>
      )}

      <Card padding="none">
        <div className="px-5 py-4 border-b border-black/[0.06] font-semibold text-[15px]">Where each person is</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-black/45 border-b border-black/[0.06]">
                <th className="px-4 py-3">Agent</th>
                {STAGES.map((s) => (
                  <th key={s.key} className="px-3 py-3 whitespace-nowrap">
                    {s.label}
                  </th>
                ))}
                <th className="px-4 py-3 whitespace-nowrap">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05]">
              {agents.map((r) => (
                <tr key={r.profileId}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-black/45">
                      {r.email}
                      {r.leaderName ? ` · under ${r.leaderName}` : ""}
                    </div>
                  </td>
                  {STAGES.map((s) => {
                    const done = reached(r, s.key);
                    const failed = s.key === "whatsappConnected" && !done && r.connectFailures > 0;
                    return (
                      <td key={s.key} className="px-3 py-3">
                        {done ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckIcon className="w-4 h-4" />
                            {s.key === "trainingCount" && (
                              <span className="text-xs tabular-nums">{r.trainingCount}</span>
                            )}
                            {s.key === "liveReplies" && <span className="text-xs tabular-nums">{r.liveReplies}</span>}
                          </span>
                        ) : failed ? (
                          <span className="inline-flex items-center gap-1 text-red-600 text-xs">
                            <AlertIcon className="w-4 h-4" />
                            {r.connectFailures} failed
                          </span>
                        ) : (
                          <span className="text-black/20">&mdash;</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-xs text-black/45 whitespace-nowrap">
                    {r.lastLogin ? ago(r.lastLogin) : "never"}
                  </td>
                </tr>
              ))}
              {loaded && agents.length === 0 && (
                <tr>
                  <td colSpan={STAGES.length + 2} className="px-4 py-6 text-sm text-black/40">
                    No agents enrolled yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding="none">
        <div className="px-5 py-4 border-b border-black/[0.06] font-semibold text-[15px]">What just happened</div>
        <div className="max-h-[32rem] overflow-y-auto divide-y divide-black/[0.04]">
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 px-5 py-2.5 text-sm">
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${e.ok ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{e.who}</span>
                <span className={e.ok ? "text-black/55" : "text-red-700"}> &mdash; {e.summary}</span>
              </span>
              <span className="shrink-0 text-xs text-black/35 tabular-nums">{ago(e.at)}</span>
            </div>
          ))}
          {loaded && events.length === 0 && (
            <p className="px-5 py-6 text-sm text-black/40">
              Nothing logged yet. Events appear here as people use the app.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
