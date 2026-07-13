import type { StoreProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { chatComplete, extractJson, llmConfigured, type ChatMessage } from "@/lib/ai/llm";
import {
  InterviewOutputSchema,
  IdentityBrainSchema,
  SalesBrainSchema,
  FulfillmentBrainSchema,
  CatalogRulesSchema,
  type InterviewOutput,
} from "@/lib/ai/schemas";
import { parseJson, toJson } from "@/lib/json";
import { LlmNotConfiguredError } from "@/lib/ai/engine";

// AI-led setup interview: instead of a cold form, GC interviews the agent
// conversationally and fills the four brains. Same JSON-output-contract
// discipline as the sales engine — the model proposes brain edits, code
// merges them. A `readyToWrapUp` flag ends the interview.

function buildInterviewPrompt(profile: StoreProfile): string {
  const identity = IdentityBrainSchema.parse(parseJson(profile.identityBrain, {}));
  const sales = SalesBrainSchema.parse(parseJson(profile.salesBrain, {}));
  const fulfillment = FulfillmentBrainSchema.parse(parseJson(profile.fulfillmentBrain, {}));
  const catalog = CatalogRulesSchema.parse(parseJson(profile.catalogRules, {}));

  return `You are the setup assistant for GC Top Sales — an AI sales assistant that sells MAE Global wellness products for a Malaysian MAE agent over WhatsApp/Instagram/Messenger. You are interviewing THIS AGENT (the business owner) to configure how their GC will sell. You are NOT talking to a customer.

Your job: through a warm, efficient conversation (not a long form), learn the specifics only this agent knows, and fill four "brains". The MAE product knowledge, pricing, certifications and objection scripts are ALREADY loaded — do NOT ask about products or prices. Focus on what's unique to this agent:

1. Identity — their store name, their own name, their personal brand voice/tone, who their typical customers are, what makes buying from THEM (vs another agent) special.
2. Sales — how pushy/soft they want GC to be, their follow-up preference, anything GC should always or never say, their own selling style.
3. Fulfillment — THE CRITICAL ONE: their exact payment details (bank name, account number, account holder name, DuitNow/TNG), how they want customers to pay, whether they do COD, their shipping approach, self-pickup, and any topics they want handled by a human only.
4. Catalog rules — any personal promos, their membership-signup pitch preference.

Rules for the conversation:
- Ask ONE focused question at a time, building on their answers. Keep it short and friendly.
- Payment details are the most important thing to nail down precisely (GC uses them to verify payment screenshots) — make sure you get bank/account name/number or e-wallet clearly.
- Confirm what's already filled rather than re-asking; the current brain values are shown below.
- When you have enough to make GC effective (at minimum: agent name, tone, and payment details), set readyToWrapUp=true and give a warm closing summary of what you configured.

Current brain values (JSON):
identity=${toJson(identity)}
sales=${toJson(sales)}
fulfillment=${toJson(fulfillment)}
catalog=${toJson(catalog)}

MANDATORY OUTPUT CONTRACT — respond with EXACTLY one JSON object, nothing else:
{
  "reply": "your next message to the agent",
  "extracted": {
    "identityBrain": { ...only fields you learned/updated this turn... },
    "salesBrain": { ... },
    "fulfillmentBrain": { ... },
    "catalogRules": { ... }
  },
  "readyToWrapUp": boolean
}
Only include brain keys/fields you actually learned this turn (omit the rest). Never invent details the agent didn't give. If they haven't given payment details yet, keep readyToWrapUp=false.`;
}

export async function runInterviewTurn(opts: {
  profile: StoreProfile;
  history: ChatMessage[];
  agentMessage: string | null;
}): Promise<{ output: InterviewOutput; profile: StoreProfile }> {
  if (!llmConfigured()) throw new LlmNotConfiguredError();
  const system = buildInterviewPrompt(opts.profile);

  const messages: ChatMessage[] = [...opts.history];
  if (opts.agentMessage !== null) messages.push({ role: "user", content: opts.agentMessage });
  if (messages.length === 0) {
    messages.push({ role: "user", content: "SYSTEM: Start the setup interview with a warm greeting and your first question." });
  }

  const raw = await chatComplete({ system, messages, maxTokens: 2000, temperature: 0.6 });
  let parsed = InterviewOutputSchema.safeParse(extractJson(raw));
  if (!parsed.success) {
    const retry = await chatComplete({
      system,
      messages: [
        ...messages,
        { role: "assistant", content: raw },
        { role: "user", content: "SYSTEM: That wasn't valid JSON matching the contract. Re-send as ONE JSON object only." },
      ],
      maxTokens: 2000,
      temperature: 0.3,
    });
    parsed = InterviewOutputSchema.safeParse(extractJson(retry));
  }

  const output: InterviewOutput = parsed.success
    ? parsed.data
    : { reply: raw.trim() || "Could you tell me a bit about your store?", extracted: {}, readyToWrapUp: false };

  // Merge extracted brain edits into the profile (deep-merge per brain).
  const updated = await applyInterviewExtract(opts.profile, output);
  return { output, profile: updated };
}

async function applyInterviewExtract(profile: StoreProfile, output: InterviewOutput): Promise<StoreProfile> {
  const ex = output.extracted ?? {};
  const data: Record<string, unknown> = {};

  if (ex.identityBrain) {
    const merged = { ...parseJson(profile.identityBrain, {}), ...stripEmpty(ex.identityBrain) };
    data.identityBrain = toJson(merged);
    if (typeof (ex.identityBrain as { storeName?: string }).storeName === "string")
      data.storeName = (ex.identityBrain as { storeName?: string }).storeName;
    if (typeof (ex.identityBrain as { agentName?: string }).agentName === "string")
      data.agentName = (ex.identityBrain as { agentName?: string }).agentName;
  }
  if (ex.salesBrain) data.salesBrain = toJson({ ...parseJson(profile.salesBrain, {}), ...stripEmpty(ex.salesBrain) });
  if (ex.fulfillmentBrain)
    data.fulfillmentBrain = toJson({ ...parseJson(profile.fulfillmentBrain, {}), ...stripEmpty(ex.fulfillmentBrain) });
  if (ex.catalogRules) data.catalogRules = toJson({ ...parseJson(profile.catalogRules, {}), ...stripEmpty(ex.catalogRules) });

  if (output.readyToWrapUp) data.onboardingStatus = "COMPLETED";

  if (Object.keys(data).length === 0) return profile;
  return prisma.storeProfile.update({ where: { id: profile.id }, data });
}

// Don't let empty strings from the model wipe existing values.
function stripEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.trim() === "") continue;
    if (v == null) continue;
    out[k] = v;
  }
  return out;
}
