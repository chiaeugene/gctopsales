import { prisma } from "@/lib/prisma";
import type { StoreProfile } from "@prisma/client";
import { parseJson } from "@/lib/json";
import { llmConfigured, chatComplete, describeUpstreamError } from "@/lib/ai/llm";

/**
 * "Will the bot actually reply?" — answered by checking, not by hoping.
 *
 * Every failure this session was invisible until a customer got silence: an
 * expired Meta token, an overloaded provider, an empty billing balance, a chat
 * frozen for takeover, a channel connected to the wrong account. Each one is
 * cheap to detect and impossible to guess at, so this walks the whole chain a
 * message travels and reports where it would break.
 *
 * Ordered the way a message actually flows: Meta reaches us, we can think, we
 * have something to say, and we can take the money. A failure early in that
 * chain makes later ones irrelevant, so the first red is the one to fix.
 */

export type CheckStatus = "pass" | "warn" | "fail";

export type Check = {
  key: string;
  /** What this proves, in the agent's language, not the system's. */
  label: string;
  status: CheckStatus;
  detail: string;
  /** The single next action. Empty when nothing is needed. */
  fix?: string;
};

const GRAPH = `https://graph.facebook.com/${process.env.META_API_VERSION || "v21.0"}`;

export async function runHealthChecks(profile: StoreProfile, opts?: { pingLlm?: boolean }): Promise<{
  ok: boolean;
  checks: Check[];
}> {
  const checks: Check[] = [];

  // ---------------------------------------------------------- 1. the channel --
  const channels = await prisma.channelConnection.findMany({
    where: { profileId: profile.id, isActive: true },
  });
  const whatsapp = channels.find((c) => c.channel === "WHATSAPP");

  if (channels.length === 0) {
    checks.push({
      key: "channel",
      label: "A customer can reach you",
      status: "fail",
      detail: "No WhatsApp, Messenger or Instagram account is connected, so no customer message can arrive.",
      fix: "Connect WhatsApp on this page.",
    });
  } else {
    checks.push({
      key: "channel",
      label: "A customer can reach you",
      status: "pass",
      detail: `${channels.map((c) => c.displayName || c.channel).join(", ")} connected.`,
    });
  }

  // ------------------------------------------------- 2. the token still works --
  // A stored token is not a working token. Meta's test numbers expire after 24
  // hours and a real one can be revoked at any time, and the only symptom is
  // silence. One cheap call to the phone-number node settles it.
  if (whatsapp) {
    try {
      const res = await fetch(`${GRAPH}/${whatsapp.externalId}?fields=display_phone_number,verified_name,quality_rating`, {
        headers: { Authorization: `Bearer ${whatsapp.accessToken}` },
      });
      const json = (await res.json()) as {
        display_phone_number?: string;
        verified_name?: string;
        quality_rating?: string;
        error?: { message?: string; code?: number };
      };
      if (!res.ok) {
        checks.push({
          key: "token",
          label: "WhatsApp still accepts your connection",
          status: "fail",
          detail:
            json.error?.message ??
            "Meta rejected the saved connection. This is what happens when a test number's 24-hour token expires.",
          fix: "Reconnect WhatsApp on this page.",
        });
      } else {
        const quality = json.quality_rating && json.quality_rating !== "GREEN";
        checks.push({
          key: "token",
          label: "WhatsApp still accepts your connection",
          status: quality ? "warn" : "pass",
          detail: `${json.verified_name ?? "Your number"} (${json.display_phone_number ?? whatsapp.externalId})` +
            (json.quality_rating ? `, quality ${json.quality_rating.toLowerCase()}` : ""),
          fix: quality
            ? "Quality has dropped, usually from customers blocking or reporting. Send fewer unsolicited messages."
            : undefined,
        });
      }
    } catch {
      checks.push({
        key: "token",
        label: "WhatsApp still accepts your connection",
        status: "fail",
        detail: "Could not reach Meta to check the connection.",
        fix: "Try again in a moment. If it keeps failing, reconnect WhatsApp.",
      });
    }
  }

  // -------------------------------------------------------- 3. GC can think ---
  if (!llmConfigured()) {
    checks.push({
      key: "ai",
      label: "GC can write a reply",
      status: "fail",
      detail: "No AI provider is configured on the server.",
      fix: "Ask your platform admin to set ANTHROPIC_API_KEY.",
    });
  } else if (opts?.pingLlm) {
    // A real round trip. Costs a fraction of a sen and is the only way to know the
    // key works and the billing balance is not empty — the exact failure that took
    // GC offline for hours without anybody noticing.
    try {
      await chatComplete({
        system: "Reply with the single word: ok",
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 5,
      });
      checks.push({
        key: "ai",
        label: "GC can write a reply",
        status: "pass",
        detail: "The AI answered a test message just now.",
      });
    } catch (err) {
      const upstream = describeUpstreamError(err);
      checks.push({
        key: "ai",
        label: "GC can write a reply",
        status: "fail",
        detail: upstream?.message ?? "The AI did not answer a test message.",
        fix: upstream?.kind === "no_credit" ? "Top up the Anthropic billing balance." : "Check the error log.",
      });
    }
  } else {
    checks.push({
      key: "ai",
      label: "GC can write a reply",
      status: "pass",
      detail: "An AI provider is configured.",
    });
  }

  // ------------------------------------------------ 4. today's budget is left --
  const cap = Number(process.env.GC_DAILY_REPLY_CAP ?? 200);
  if (cap > 0) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const used = await prisma.message.count({
      where: { role: "GC", createdAt: { gte: since }, conversation: { profileId: profile.id } },
    });
    const left = cap - used;
    checks.push({
      key: "cap",
      label: "You have replies left today",
      status: left <= 0 ? "fail" : left < cap * 0.15 ? "warn" : "pass",
      detail: `${used} of ${cap} used today.`,
      fix: left <= 0 ? "The daily cap is reached. It resets at midnight, or ask your admin to raise it." : undefined,
    });
  }

  // ----------------------------------------------- 5. GC has something to sell -
  const [products, withPhoto] = await Promise.all([
    prisma.product.count({ where: { profileId: profile.id, isActive: true } }),
    prisma.product.count({ where: { profileId: profile.id, isActive: true, attachments: { some: {} } } }),
  ]);
  checks.push({
    key: "catalogue",
    label: "GC has products to sell",
    status: products === 0 ? "fail" : withPhoto === 0 ? "warn" : "pass",
    detail: `${products} active product${products === 1 ? "" : "s"}, ${withPhoto} with a photo.`,
    fix:
      products === 0
        ? "Ask your admin to push the catalogue to your account."
        : withPhoto === 0
          ? "Quoting a price with no picture loses chat buyers. Add photos on the Products page."
          : undefined,
  });

  // ----------------------------------------------------- 6. a buyer can pay ----
  const f = parseJson<Record<string, string>>(profile.fulfillmentBrain, {});
  const PLACEHOLDER = /CONFIGURE ME|UPDATE ME/i;
  const filled = (v?: string) => Boolean(v && v.trim() && !PLACEHOLDER.test(v));
  const bankComplete = filled(f.paymentBank) && filled(f.paymentAccountName) && filled(f.paymentAccountNumber);
  checks.push({
    key: "payment",
    label: "A customer who says yes can pay you",
    status: bankComplete || filled(f.paymentMethods) ? "pass" : "fail",
    detail: bankComplete
      ? `${f.paymentBank} ${f.paymentAccountNumber} (${f.paymentAccountName})`
      : filled(f.paymentMethods)
        ? "Payment methods are set, but bank, account name and number are not all filled in."
        : "No payment details. GC will sell normally and then hand the chat to you at the moment of payment.",
    fix: bankComplete ? undefined : "Fill in bank, account holder name and account number in Settings.",
  });

  // -------------------------------------------- 7. nothing is silently frozen --
  // GC goes deliberately silent on a chat the agent has taken over. That is
  // correct behaviour and a common cause of "the bot stopped replying".
  const frozen = await prisma.order.count({ where: { profileId: profile.id, needsHuman: true } });
  checks.push({
    key: "frozen",
    label: "No chat is waiting on you",
    status: frozen > 0 ? "warn" : "pass",
    detail:
      frozen > 0
        ? `${frozen} chat${frozen === 1 ? " is" : "s are"} paused for you. GC will not reply in ${frozen === 1 ? "it" : "them"} until you hand it back.`
        : "GC is answering every open chat.",
    fix: frozen > 0 ? "Open them in the Workspace and click 'Let GC take over again' when you are done." : undefined,
  });

  // ------------------------------------------------ 8. recent failures, if any -
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentErrors = await prisma.errorLog.count({ where: { createdAt: { gte: since } } });
  if (recentErrors > 0) {
    const latest = await prisma.errorLog.findFirst({ orderBy: { createdAt: "desc" } });
    checks.push({
      key: "errors",
      label: "Nothing failed in the last 24 hours",
      status: "warn",
      detail: `${recentErrors} error${recentErrors === 1 ? "" : "s"} logged. Most recent: ${(latest?.message ?? "").slice(0, 120)}`,
      fix: "Usually a brief AI overload that has already cleared. Admin has the full log.",
    });
  } else {
    checks.push({
      key: "errors",
      label: "Nothing failed in the last 24 hours",
      status: "pass",
      detail: "No errors logged.",
    });
  }

  return { ok: !checks.some((c) => c.status === "fail"), checks };
}
