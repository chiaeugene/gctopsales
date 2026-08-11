import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { generateGcReply } from "@/lib/ai/engine";
import { splitIntoBubbles } from "@/lib/ai/humanize";
import { toJson } from "@/lib/json";

/**
 * Builds the demo chats that sit in the master account's Workspace, ready to
 * open, so a new person sees GC selling before they type anything.
 *
 * These are REAL conversations, not scripted transcripts. Each turn goes through
 * generateGcReply exactly as a WhatsApp customer would, which costs a few calls
 * but means nobody is ever shown a reply GC did not actually write. It also
 * doubles as a live check on the shape rules: the response reports the bubble
 * count of every reply, whether a price appeared before any problem was
 * described, and whether GC named a condition the customer never mentioned.
 *
 * ONE scenario per request. Four scenarios of three turns each in a single
 * request is a minute of LLM calls, which is long enough to hit a proxy timeout
 * and lose the lot. The UI loops and shows progress instead.
 */

// The first scenario is deliberately the exact conversation that exposed the
// history bug: a lead-magnet keyword, then a vague question, then price
// resistance. If GC ever quotes a number on turn one again, this demo shows it.
const SCENARIOS = [
  {
    label: "Skincare, from a post reply",
    name: "Demo · skincare (pm skincare)",
    turns: ["pm skincare", "How can it helps me", "Too expensive"],
  },
  {
    label: "Hair fall",
    name: "Demo · hair fall",
    turns: ["My hair drop a lot every time I shower. Got shampoo for that?", "Stress i think, quite bad these few months", "How much for the shampoo"],
  },
  {
    label: "Bloating and constipation",
    name: "Demo · gut health",
    turns: ["I always bloated and cannot go toilet properly", "Almost every day already, very uncomfortable", "Ok interested, how to order"],
  },
  {
    label: "Stress and sleep, in Mandarin",
    name: "Demo · 压力失眠",
    turns: ["最近压力很大，晚上睡不好，有什么可以帮我吗？", "差不多半年了", "有没有人用过，有效果吗？"],
  },
];

export async function GET() {
  return handle(async () => {
    await requireProfile();
    return { scenarios: SCENARIOS.map((s, i) => ({ index: i, label: s.label, turns: s.turns.length })) };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    // Own-profile only, deliberately: the demos belong to whoever is looking at
    // them, and one admin should not be dropping chats into another agent's
    // Workspace.
    const profile = await requireProfile();
    const body = z.object({ scenario: z.number().int().min(0).max(SCENARIOS.length - 1) }).safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Which scenario?");
    const scenario = SCENARIOS[body.data.scenario];

    const products = await prisma.product.count({ where: { profileId: profile.id, isActive: true } });
    if (products === 0) throw new ApiError(400, "This account has no products yet, so GC has nothing to sell in a demo.");

    // Replace the previous run of this scenario rather than piling up copies.
    await prisma.order.deleteMany({ where: { profileId: profile.id, source: "PLAYGROUND", customerName: scenario.name } });

    const created = await prisma.order.create({
      data: {
        profileId: profile.id,
        source: "PLAYGROUND",
        customerName: scenario.name,
        conversation: { create: { profileId: profile.id, kind: "PLAYGROUND" } },
      },
      include: { conversation: true },
    });
    const conversationId = created.conversation!.id;

    let order = created;
    const replies: { bubbles: number; emoji: number; images: number; text: string }[] = [];

    for (const turn of scenario.turns) {
      const { output, order: next, attachmentIds } = await generateGcReply({
        profile,
        order,
        conversationId,
        customerMessage: turn,
      });
      order = { ...next, conversation: created.conversation };

      await prisma.message.create({ data: { conversationId, role: "CUSTOMER", content: turn } });
      await prisma.message.create({
        data: { conversationId, role: "GC", content: output.reply, attachmentIds: toJson(attachmentIds) },
      });

      replies.push({
        bubbles: splitIntoBubbles(output.reply).length,
        emoji: (output.reply.match(/\p{Extended_Pictographic}/gu) ?? []).length,
        images: attachmentIds.length,
        text: output.reply,
      });
    }

    // The three shape failures from the live WhatsApp test, checked here so they
    // cannot come back quietly.
    const first = replies[0]?.text ?? "";
    const checks = {
      priceOnFirstReply: /\b(RM|MYR|S\$|SGD)\s?\d{2,}/i.test(first),
      assumedACondition: /\b(acne|jerawat|eczema|melasma|rosacea)\b/i.test(first),
      alwaysThreeBubbles: replies.length > 1 && replies.every((r) => r.bubbles === 3),
    };

    return {
      label: scenario.label,
      orderId: created.id,
      bubbles: replies.map((r) => r.bubbles),
      emoji: replies.map((r) => r.emoji),
      images: replies.reduce((n, r) => n + r.images, 0),
      checks,
    };
  });
}
