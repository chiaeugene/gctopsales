import { prisma } from "@/lib/prisma";

/**
 * The rollout watcher: who signed in, who set up, who connected WhatsApp, who is
 * actually selling.
 *
 * Fire-and-forget by design. A log line is never worth failing a customer reply
 * for, so every call swallows its own errors and nothing awaits it in a hot path.
 *
 * `summary` is written at the call site rather than assembled later, because the
 * call site is the only place that knows what actually happened.
 */
export type ActivityType =
  | "login"
  | "tour_opened"
  | "setup_message"
  | "setup_done"
  | "training_saved"
  | "payment_saved"
  | "menu_saved"
  | "connect_started"
  | "connect_ok"
  | "connect_failed"
  | "health_check"
  | "practice_reply"
  | "live_inbound"
  | "live_reply"
  | "reset"
  | "edit"
  | "takeover"
  | "page";

export function logActivity(opts: {
  profileId?: string | null;
  actor: string;
  type: ActivityType;
  summary: string;
  ok?: boolean;
}): void {
  prisma.activityEvent
    .create({
      data: {
        profileId: opts.profileId ?? null,
        actor: opts.actor,
        type: opts.type,
        summary: opts.summary.slice(0, 300),
        ok: opts.ok ?? true,
      },
    })
    .catch(() => {});
}
