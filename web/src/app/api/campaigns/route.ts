import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { findTargets, draftCampaignMessages, SEGMENT_LABELS, type Segment } from "@/lib/campaigns";
import { chatComplete, extractJson, llmConfigured } from "@/lib/ai/llm";
import { parseJson } from "@/lib/json";
import { CatalogRulesSchema } from "@/lib/ai/schemas";
import { sendWhatsAppText, sendWhatsAppTemplate } from "@/lib/channels/whatsapp";
import { sendMetaText } from "@/lib/channels/meta-messaging";

export async function GET() {
  return handle(async () => {
    await requireProfile();
    return { segments: Object.entries(SEGMENT_LABELS).map(([value, label]) => ({ value, label })) };
  });
}

const PreviewSchema = z.object({
  action: z.literal("preview"),
  segment: z.enum(["warm_quiet", "interested_no_buy", "past_buyers"]),
  offer: z.string().min(3).max(1000),
});

const SendSchema = z.object({
  action: z.literal("send"),
  messages: z.array(z.object({ orderId: z.string(), message: z.string().min(1).max(2000) })).min(1).max(30),
});

const SendTemplateSchema = z.object({
  action: z.literal("send_template"),
  templateId: z.string(),
  vars: z.array(z.string().max(500)).max(10),
  orderIds: z.array(z.string()).min(1).max(50),
});

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = await req.json();

    // GC cooks up campaign ideas from the agent's actual lead base — the agent
    // picks one instead of inventing an offer from scratch.
    if (body?.action === "suggest") {
      if (!llmConfigured()) throw new ApiError(503, "AI not configured");
      const [segments, catalog] = await Promise.all([
        Promise.all(
          (Object.keys(SEGMENT_LABELS) as Segment[]).map(async (seg) => ({
            segment: seg,
            label: SEGMENT_LABELS[seg],
            targets: (await findTargets(profile, seg)).slice(0, 40),
          }))
        ),
        Promise.resolve(CatalogRulesSchema.parse(parseJson(profile.catalogRules, {}))),
      ]);

      const baseSummary = segments
        .map((s) => {
          const interests = s.targets
            .map((t) => t.productInterest)
            .filter(Boolean)
            .slice(0, 12)
            .join(", ");
          return `${s.label} (${s.segment}): ${s.targets.length} leads${interests ? `; interested in: ${interests}` : ""}`;
        })
        .join("\n");

      const raw = await chatComplete({
        system: `You are a retention-marketing strategist for a MAE Global wellness seller. Given their current lead base and running promotions, propose the 2-3 BEST re-engagement campaigns to run right now. Respond ONLY with JSON: {"ideas": [{"title": "short catchy name", "segment": "warm_quiet"|"interested_no_buy"|"past_buyers", "offer": "2-3 sentence campaign brief GC will use to personalize each message (the angle, the honest urgency lever, the product focus)", "why": "1 sentence on why this segment+angle now"}]}. Rules: only honest urgency (real promos, first-purchase gifts, membership benefits, health-goal momentum); never invent discounts; if a promotion is listed below, build at least one idea around it; skip segments with 0 leads.`,
        messages: [
          {
            role: "user",
            content: `LEAD BASE:\n${baseSummary}\n\nCURRENT PROMOTIONS: ${catalog.currentPromotions || "none listed"}`,
          },
        ],
        maxTokens: 900,
        temperature: 0.6,
      });
      const json = extractJson(raw) as { ideas?: { title: string; segment: string; offer: string; why: string }[] } | null;
      const valid = new Set(Object.keys(SEGMENT_LABELS));
      return { ideas: (json?.ideas ?? []).filter((i) => valid.has(i.segment)).slice(0, 3) };
    }

    if (body?.action === "preview") {
      const parsed = PreviewSchema.safeParse(body);
      if (!parsed.success) throw new ApiError(400, "Invalid preview payload");
      const targets = await findTargets(profile, parsed.data.segment as Segment);
      const drafts = await draftCampaignMessages(profile, targets, parsed.data.offer);
      return {
        targets: targets.map((t) => ({
          orderId: t.orderId,
          name: t.name,
          source: t.source,
          productInterest: t.productInterest,
          inWindow: t.inWindow,
          channelReady: t.channelReady,
          sendable: t.inWindow && t.channelReady,
          message: drafts[t.orderId] ?? "",
        })),
      };
    }

    if (body?.action === "send") {
      const parsed = SendSchema.safeParse(body);
      if (!parsed.success) throw new ApiError(400, "Invalid send payload");

      let sent = 0;
      const skipped: string[] = [];
      for (const item of parsed.data.messages) {
        const order = await prisma.order.findFirst({
          where: { id: item.orderId, profileId: profile.id },
          include: { conversation: true },
        });
        if (!order || !order.externalContactId || order.source === "PLAYGROUND") {
          skipped.push(item.orderId);
          continue;
        }
        // Re-check the 24h window at send time — never violate it.
        const lastAt = order.lastCustomerMessageAt ?? order.updatedAt;
        const hours = (Date.now() - new Date(lastAt).getTime()) / 3600_000;
        if (hours > 24) {
          skipped.push(item.orderId);
          continue;
        }
        const connection = await prisma.channelConnection.findFirst({
          where: { profileId: profile.id, channel: order.source, isActive: true },
        });
        if (!connection) {
          skipped.push(item.orderId);
          continue;
        }

        // Deliver on the channel.
        if (order.source === "WHATSAPP") {
          await sendWhatsAppText({ phoneNumberId: connection.externalId, accessToken: connection.accessToken }, order.externalContactId, item.message);
        } else {
          await sendMetaText({ pageId: connection.externalId, accessToken: connection.accessToken }, order.externalContactId, item.message);
        }

        // Record it on the conversation so history stays complete.
        const conversationId =
          order.conversation?.id ??
          (await prisma.conversation.create({ data: { profileId: profile.id, kind: order.source, orderId: order.id } })).id;
        await prisma.message.create({ data: { conversationId, role: "GC", content: item.message } });
        sent++;
      }

      return { sent, skipped: skipped.length };
    }

    // Reach OUT-OF-WINDOW WhatsApp leads with an approved template — the only
    // compliant way past the 24h window. vars are campaign-wide; the token
    // "{name}" is replaced per lead with the customer's name.
    if (body?.action === "send_template") {
      const parsed = SendTemplateSchema.safeParse(body);
      if (!parsed.success) throw new ApiError(400, "Invalid template-send payload");

      const template = await prisma.messageTemplate.findFirst({
        where: { id: parsed.data.templateId, profileId: profile.id },
      });
      if (!template) throw new ApiError(404, "Template not found");
      if (template.status !== "APPROVED") throw new ApiError(400, "Template is not approved by Meta yet");

      let sent = 0;
      const skipped: string[] = [];
      for (const orderId of parsed.data.orderIds) {
        const order = await prisma.order.findFirst({
          where: { id: orderId, profileId: profile.id },
          include: { conversation: true },
        });
        if (!order || order.source !== "WHATSAPP" || !order.externalContactId) {
          skipped.push(orderId);
          continue;
        }
        const connection = await prisma.channelConnection.findFirst({
          where: { profileId: profile.id, channel: "WHATSAPP", isActive: true },
        });
        if (!connection) {
          skipped.push(orderId);
          continue;
        }
        const bodyParams = parsed.data.vars.map((v) => v.replaceAll("{name}", order.customerName || "there"));
        const ok = await sendWhatsAppTemplate(
          { phoneNumberId: connection.externalId, accessToken: connection.accessToken },
          order.externalContactId,
          template.name,
          template.language,
          bodyParams
        );
        if (!ok) {
          skipped.push(orderId);
          continue;
        }
        const conversationId =
          order.conversation?.id ??
          (await prisma.conversation.create({ data: { profileId: profile.id, kind: "WHATSAPP", orderId: order.id } })).id;
        const filled = template.bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => bodyParams[Number(n) - 1] ?? `{{${n}}}`);
        await prisma.message.create({ data: { conversationId, role: "GC", content: `[template:${template.name}] ${filled}` } });
        sent++;
      }
      return { sent, skipped: skipped.length };
    }

    throw new ApiError(400, "Unknown action");
  });
}
