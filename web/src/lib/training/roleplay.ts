import type { StoreProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { chatComplete, llmConfigured, extractJson, type ChatMessage } from "@/lib/ai/llm";
import { getScenario } from "@/lib/training/scenarios";
import { SalesBrainSchema } from "@/lib/ai/schemas";
import { parseJson, toJson } from "@/lib/json";
import { LlmNotConfiguredError } from "@/lib/ai/engine";

// In a role-play, ROLES ARE FLIPPED: GC plays the CUSTOMER (the archetype),
// and the human agent plays the seller. This lets the agent demonstrate their
// own selling voice, which we later synthesize into styleProfile.

function buildCustomerPrompt(profile: StoreProfile, scenarioKey: string): string {
  const scenario = getScenario(scenarioKey);
  const store = profile.storeName || "a MAE store";
  return `You are role-playing as a REALISTIC Malaysian customer messaging ${store} on WhatsApp. You are the CUSTOMER, not the seller. The human you're chatting with is the shop owner practising their sales skills.

Your character: ${scenario?.title ?? "a customer"} — ${scenario?.focus ?? ""}.

Behave like a real customer of this type: chat casually (English / Malaysian Mandarin / rojak as feels natural), have real concerns, don't be too easy OR too hostile. React genuinely to how well the seller handles you — if they understand you and build value, warm up and move toward buying; if they just dump a price or pressure you, stay hesitant. Keep messages short like real WhatsApp. Never break character, never mention you're an AI or a role-play. Just reply as the customer in plain text (no JSON).`;
}

export async function roleplayCustomerTurn(opts: {
  profile: StoreProfile;
  scenarioKey: string;
  history: ChatMessage[];
  agentMessage: string | null;
}): Promise<string> {
  if (!llmConfigured()) throw new LlmNotConfiguredError();
  const system = buildCustomerPrompt(opts.profile, opts.scenarioKey);
  const scenario = getScenario(opts.scenarioKey);

  const messages: ChatMessage[] = [...opts.history];
  if (opts.agentMessage !== null) {
    // Agent = the seller = "user" from the customer-model's POV.
    messages.push({ role: "user", content: opts.agentMessage });
  }
  if (messages.length === 0) {
    // Kick off with the scenario's opener directly (no model call needed).
    return scenario?.opener ?? "Hi";
  }
  return (await chatComplete({ system, messages, maxTokens: 500, temperature: 0.8 })).trim();
}

// After a role-play (or several), synthesize the agent's demonstrated voice
// into salesBrain.styleProfile — a short instruction the real sales prompt
// injects so GC sounds like THIS agent.
export async function synthesizeStyleProfile(profile: StoreProfile): Promise<string | null> {
  if (!llmConfigured()) throw new LlmNotConfiguredError();

  // Gather the agent's own replies across all training conversations.
  const convos = await prisma.conversation.findMany({
    where: { profileId: profile.id, kind: "TRAINING" },
    include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
  });
  const agentLines: string[] = [];
  for (const c of convos) {
    for (const m of c.messages) {
      // In training, the human agent's messages are stored as role AGENT.
      if (m.role === "AGENT") agentLines.push(m.content);
    }
  }
  if (agentLines.length < 3) return null; // not enough signal yet

  const raw = await chatComplete({
    system:
      'You analyze a salesperson\'s real messages and distill their personal selling VOICE into a concise style guide another assistant can follow. Respond ONLY with JSON: {"styleProfile": "3-6 sentences describing their tone, warmth, language mix, emoji habits, sentence length, how they handle objections and close — concrete enough to imitate"}. Describe the STYLE, never copy specific product/price content.',
    messages: [{ role: "user", content: agentLines.slice(-40).join("\n---\n").slice(0, 6000) }],
    maxTokens: 600,
    temperature: 0.3,
  });
  const json = extractJson(raw) as { styleProfile?: string } | null;
  const styleProfile = json?.styleProfile?.trim();
  if (!styleProfile) return null;

  const sales = SalesBrainSchema.parse(parseJson(profile.salesBrain, {}));
  await prisma.storeProfile.update({
    where: { id: profile.id },
    data: { salesBrain: toJson({ ...sales, styleProfile }) },
  });
  return styleProfile;
}
