import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { chatComplete, extractJson, llmConfigured } from "@/lib/ai/llm";
import { parseJson } from "@/lib/json";
import { IdentityBrainSchema, FulfillmentBrainSchema } from "@/lib/ai/schemas";

// GC drafts a practical starter library from THIS agent's brains — usable
// today as copy-paste snippets, submittable to Meta when WhatsApp connects.
export async function PUT() {
  return handle(async () => {
    const profile = await requireProfile();
    if (!llmConfigured()) throw new ApiError(503, "AI not configured");

    const identity = IdentityBrainSchema.parse(parseJson(profile.identityBrain, {}));
    const fulfillment = FulfillmentBrainSchema.parse(parseJson(profile.fulfillmentBrain, {}));
    const store = identity.storeName || profile.storeName || "our store";
    const agent = identity.agentName || profile.agentName || "your consultant";

    const raw = await chatComplete({
      system: `You write WhatsApp message templates for ${store} (MAE Global wellness seller, agent name ${agent}). Create exactly 5 practical templates covering: (1) warm re-introduction to a quiet lead, (2) gentle payment reminder, (3) order shipped/on-the-way update, (4) post-delivery check-in + reorder nudge, (5) current-promo announcement. Rules: warm Malaysian WhatsApp tone, light emoji ok, 2-4 sentences each, use {{1}} for the customer's name and {{2}}/{{3}} for other variable slots where useful, never invent discounts or prices, no dashes as punctuation. Respond ONLY with JSON: {"templates": [{"name": "lowercase_snake_name", "language": "en", "category": "MARKETING"|"UTILITY", "bodyText": "...", "variableHint": "what each {{n}} means"}]}.`,
      messages: [
        {
          role: "user",
          content: `Shipping policy: ${fulfillment.shippingPolicy || "standard"}. Payment methods: ${fulfillment.paymentMethods?.slice(0, 200) || "bank transfer"}.`,
        },
      ],
      maxTokens: 1800,
      temperature: 0.6,
    });
    const json = extractJson(raw) as {
      templates?: { name: string; language: string; category: string; bodyText: string; variableHint?: string }[];
    } | null;
    if (!json?.templates?.length) throw new ApiError(502, "GC could not draft templates, try again");

    let created = 0;
    for (const t of json.templates.slice(0, 5)) {
      const name = t.name.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 100) || "template";
      const category = t.category === "UTILITY" ? "UTILITY" : "MARKETING";
      const exists = await prisma.messageTemplate.findFirst({ where: { profileId: profile.id, name } });
      if (exists) continue;
      await prisma.messageTemplate.create({
        data: {
          profileId: profile.id,
          name,
          language: t.language || "en",
          category,
          bodyText: t.bodyText.slice(0, 2000),
          variableHint: t.variableHint?.slice(0, 500) ?? null,
          status: "PENDING",
        },
      });
      created++;
    }
    return { created };
  });
}

export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    const templates = await prisma.messageTemplate.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
    });
    return {
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        language: t.language,
        category: t.category,
        bodyText: t.bodyText,
        variableHint: t.variableHint,
        status: t.status,
        varCount: countVars(t.bodyText),
      })),
    };
  });
}

const UpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200).regex(/^[a-z0-9_]+$/, "lowercase letters, numbers, underscores only (match Meta)"),
  language: z.string().min(2).max(10),
  category: z.enum(["MARKETING", "UTILITY"]),
  bodyText: z.string().min(3).max(2000),
  variableHint: z.string().max(500).nullable().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = UpsertSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, body.error.issues[0]?.message || "Invalid template");
    const d = body.data;
    const data = {
      name: d.name,
      language: d.language,
      category: d.category,
      bodyText: d.bodyText,
      variableHint: d.variableHint ?? null,
      status: d.status ?? "PENDING",
    };
    if (d.id) {
      const existing = await prisma.messageTemplate.findFirst({ where: { id: d.id, profileId: profile.id } });
      if (!existing) throw new ApiError(404, "Template not found");
      await prisma.messageTemplate.update({ where: { id: existing.id }, data });
      return { id: existing.id };
    }
    const dup = await prisma.messageTemplate.findFirst({
      where: { profileId: profile.id, name: d.name, language: d.language },
    });
    if (dup) throw new ApiError(409, "A template with this name + language already exists");
    const created = await prisma.messageTemplate.create({ data: { ...data, profileId: profile.id } });
    return { id: created.id };
  });
}

const DeleteSchema = z.object({ id: z.string() });

export async function DELETE(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = DeleteSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid payload");
    const existing = await prisma.messageTemplate.findFirst({ where: { id: body.data.id, profileId: profile.id } });
    if (!existing) throw new ApiError(404, "Template not found");
    await prisma.messageTemplate.delete({ where: { id: existing.id } });
    return { ok: true };
  });
}

function countVars(body: string): number {
  const matches = body.match(/\{\{\s*\d+\s*\}\}/g);
  if (!matches) return 0;
  const nums = new Set(matches.map((m) => m.replace(/[^\d]/g, "")));
  return nums.size;
}
