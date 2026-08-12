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
    turns: ["pm skincare", "How can it helps me", "Too expensive", "Let me think about it first"],
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
    turns: ["最近压力很大，晚上睡不好，有什么可以帮我吗？", "差不多半年了", "有没有人用过，有效果吗？", "我还想考虑一下"],
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
    const replies: { customer: string; bubbles: number; emoji: number; images: number; text: string }[] = [];

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
        customer: turn,
        bubbles: splitIntoBubbles(output.reply).length,
        emoji: (output.reply.match(/\p{Extended_Pictographic}/gu) ?? []).length,
        images: attachmentIds.length,
        text: output.reply,
      });
    }

    // The shape failures caught in live WhatsApp tests, checked here so they cannot
    // come back quietly.
    const first = replies[0]?.text ?? "";
    const checks: Record<string, boolean> = {
      priceOnFirstReply: /\b(RM|MYR|S\$|SGD)\s?\d{2,}/i.test(first),
      assumedACondition: /\b(acne|jerawat|eczema|melasma|rosacea)\b/i.test(first),
      alwaysThreeBubbles: replies.length > 1 && replies.every((r) => r.bubbles === 3),
    };

    // SALES DNA, checked on the "let me think about it" turn. Turn one must locate
    // the doubt and do nothing else: end on a question, stay short, volunteer no
    // exit, and hold the certification pitch until it is actually asked for.
    const hesitation = replies.find((r) => /think about it|考虑|fikir dulu/i.test(r.customer));
    if (hesitation) {
      const lastLine = hesitation.text.trim().split(/\n+/).filter(Boolean).pop() ?? "";
      checks.hesitationEndsOnAQuestion = /[?？]\s*$/.test(lastLine);
      checks.hesitationVolunteeredAnExit =
        /tomorrow|check back|follow up|get back to you|take your time|明天|再跟你|再联络|慢慢考虑/i.test(
          hesitation.text
        );
      checks.hesitationStayedShort = hesitation.bubbles <= 2;
      checks.hesitationPitchedUnasked = /NPRA|halal|清真|认证|certifi|食品级/i.test(hesitation.text);
    }

    const problems: string[] = [];
    if (checks.priceOnFirstReply) problems.push("quoted a price on turn 1");
    if (checks.assumedACondition) problems.push("named a condition unprompted");
    if (checks.alwaysThreeBubbles) problems.push("every reply was 3 bubbles");
    if (hesitation) {
      if (!checks.hesitationEndsOnAQuestion) problems.push("hesitation reply did not end on a question");
      if (checks.hesitationVolunteeredAnExit) problems.push("volunteered the exit");
      if (!checks.hesitationStayedShort) problems.push("hesitation reply ran long");
      if (checks.hesitationPitchedUnasked) problems.push("pitched certifications unasked");
    }

    return {
      label: scenario.label,
      orderId: created.id,
      bubbles: replies.map((r) => r.bubbles),
      emoji: replies.map((r) => r.emoji),
      images: replies.reduce((n, r) => n + r.images, 0),
      testedHesitation: Boolean(hesitation),
      problems,
      checks,
    };
  });
}
