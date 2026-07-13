import type { StoreProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { chatComplete, llmConfigured } from "@/lib/ai/llm";
import { parseJson } from "@/lib/json";
import { IdentityBrainSchema } from "@/lib/ai/schemas";

// Re-engagement campaigns: draft personalized win-back / promo messages to a
// segment of past leads, and send them — respecting the messaging window.
//
// COMPLIANCE: WhatsApp/Messenger/IG only allow free-form business-initiated
// messages inside a ~24h customer-service window (since the customer's last
// message). Outside it, you must use a pre-approved template. This tool sends
// free-form only to in-window leads and flags the rest as "needs template /
// manual" — it never silently violates the window.

const MESSAGING_WINDOW_HOURS = 24;
const MAX_TARGETS = 15;

export type Segment = "warm_quiet" | "interested_no_buy" | "past_buyers";

export const SEGMENT_LABELS: Record<Segment, string> = {
  warm_quiet: "Warm leads gone quiet (1-7 days)",
  interested_no_buy: "Showed interest but didn't buy",
  past_buyers: "Past buyers (re-order / cross-sell)",
};

type Target = {
  orderId: string;
  name: string;
  source: string;
  productInterest: string | null;
  segment: string | null;
  summary: string | null;
  inWindow: boolean;
  channelReady: boolean; // real channel + we have a connection
};

export async function findTargets(profile: StoreProfile, segment: Segment): Promise<Target[]> {
  const now = Date.now();
  const day = 24 * 3600_000;

  let where: Record<string, unknown> = { profileId: profile.id };
  if (segment === "warm_quiet") {
    where = {
      profileId: profile.id,
      status: { notIn: ["Lost", "Payment Confirmed", "Processing", "Shipped", "Delivered"] },
      lastCustomerMessageAt: { gte: new Date(now - 7 * day), lte: new Date(now - 1 * day) },
    };
  } else if (segment === "interested_no_buy") {
    where = {
      profileId: profile.id,
      productInterest: { not: null },
      paymentStatus: { not: "CONFIRMED" },
      status: { not: "Lost" },
    };
  } else if (segment === "past_buyers") {
    where = { profileId: profile.id, paymentStatus: "CONFIRMED" };
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: MAX_TARGETS,
  });

  // Which channels this tenant can actually send on.
  const connections = await prisma.channelConnection.findMany({
    where: { profileId: profile.id, isActive: true },
    select: { channel: true },
  });
  const liveChannels = new Set(connections.map((c) => c.channel));

  return orders.map((o) => {
    const lastAt = o.lastCustomerMessageAt ?? o.updatedAt;
    const hours = (now - new Date(lastAt).getTime()) / 3600_000;
    return {
      orderId: o.id,
      name: o.customerName || o.externalContactId || "there",
      source: o.source,
      productInterest: o.productInterest,
      segment: o.segment,
      summary: o.summary,
      inWindow: hours <= MESSAGING_WINDOW_HOURS,
      channelReady: o.source !== "PLAYGROUND" && liveChannels.has(o.source),
    };
  });
}

// One LLM call drafts a personalized message for every target — cheaper and
// more consistent than N calls. Returns { orderId, message } pairs.
export async function draftCampaignMessages(
  profile: StoreProfile,
  targets: Target[],
  offer: string
): Promise<Record<string, string>> {
  if (!llmConfigured() || targets.length === 0) return {};
  const identity = IdentityBrainSchema.parse(parseJson(profile.identityBrain, {}));
  const agent = identity.agentName || profile.agentName || "your MAE consultant";
  const store = identity.storeName || profile.storeName || "our store";

  const list = targets.map((t) => ({
    id: t.orderId,
    name: t.name,
    interested_in: t.productInterest || "unknown",
    note: t.summary?.slice(0, 200) || "",
  }));

  const raw = await chatComplete({
    system: `You write short, warm, personalized WhatsApp re-engagement messages for ${store} (a MAE Global wellness seller, from ${agent}). Each message goes to a past lead to gently bring them back and act on this campaign/offer:

CAMPAIGN: ${offer}

Rules: reference what THAT lead cared about (their name + what they were interested in + the note) so it feels personal, not a blast. Keep it 2-4 short sentences, warm, no pressure, one easy next step. Mirror a natural Malaysian WhatsApp tone (light emoji ok). Do NOT invent facts about them beyond what's given. If interested_in is "unknown", keep it general but still warm.

Respond ONLY with a JSON array: [{"id": "<the lead id>", "message": "<the personalized message>"}] — one object per lead, using the exact ids given.`,
    messages: [{ role: "user", content: JSON.stringify(list) }],
    maxTokens: 2000,
    temperature: 0.7,
  });

  const arr = parseMessageArray(raw);
  const out: Record<string, string> = {};
  for (const item of arr) {
    if (item && typeof item.id === "string" && typeof item.message === "string") out[item.id] = item.message;
  }
  return out;
}

// The drafts come back as a top-level JSON array (not a single object), so we
// parse the outer [...] tolerantly rather than using the object extractor.
function parseMessageArray(raw: string): { id: string; message: string }[] {
  try {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
}
