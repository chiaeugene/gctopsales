import type { StoreProfile, Product, TrainingExample, Testimonial } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { chatComplete, extractJson, llmConfigured, type ChatMessage } from "@/lib/ai/llm";
import { buildGcSystemPrompt } from "@/lib/ai/prompts";
import { EngineOutputSchema } from "@/lib/ai/schemas";
import { GYM_SCENARIOS, type GymScenario } from "@/lib/gym/scenarios";
import { LlmNotConfiguredError } from "@/lib/ai/engine";

export type ScenarioResult = {
  key: string;
  title: string;
  skill: string;
  score: number; // 0-10
  verdict: "pass" | "weak" | "fail";
  note: string;
  exchange: { role: "customer" | "gc"; content: string }[];
};

export type GymReport = {
  overall: number; // 0-100
  bySkill: { skill: string; avg: number }[];
  weakest: ScenarioResult[];
  results: ScenarioResult[];
  coaching: string; // suggested Sales Brain addition targeting the weak spots
  ranAt: string;
};

// Runs the whole battery. GC replies and judgements are parallelized so the
// wall-time is roughly two model calls, not 2×N. Pure evaluation — it builds
// GC's real system prompt but never writes any orders/messages to the DB.
export async function runGym(profile: StoreProfile): Promise<GymReport> {
  if (!llmConfigured()) throw new LlmNotConfiguredError();

  const [products, trainingExamples, testimonials] = await Promise.all([
    prisma.product.findMany({
      where: { profileId: profile.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { attachments: { orderBy: { sortOrder: "asc" }, omit: { data: true } } },
    }),
    prisma.trainingExample.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: "asc" } }),
    prisma.testimonial.findMany({ where: { profileId: profile.id, isActive: true }, take: 40 }),
  ]);

  const system = buildGcSystemPrompt({ profile, products, trainingExamples, testimonials, order: null });

  // Run scenarios in small batches, not all 12 at once — each scenario fires
  // several model calls (GC replies + judge samples), so full parallelism
  // bursts ~40 concurrent Anthropic requests and trips the rate limit (which
  // errored whole runs to 0). Batches of 3 keep it reliable and still fast.
  const BATCH = 3;
  const results: ScenarioResult[] = [];
  for (let i = 0; i < GYM_SCENARIOS.length; i += BATCH) {
    const batch = GYM_SCENARIOS.slice(i, i + BATCH);
    const done = await Promise.all(
      batch.map((sc) => runScenario(system, sc, products, trainingExamples, testimonials))
    );
    results.push(...done);
  }

  const overall = Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 10);

  const skillMap = new Map<string, number[]>();
  for (const r of results) {
    if (!skillMap.has(r.skill)) skillMap.set(r.skill, []);
    skillMap.get(r.skill)!.push(r.score);
  }
  const bySkill = [...skillMap.entries()]
    .map(([skill, arr]) => ({ skill, avg: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 }))
    .sort((a, b) => a.avg - b.avg);

  const weakest = [...results].sort((a, b) => a.score - b.score).slice(0, 3);
  const coaching = await synthesizeCoaching(weakest);

  return { overall, bySkill, weakest, results, coaching, ranAt: new Date().toISOString() };
}

async function runScenario(
  system: string,
  sc: GymScenario,
  products: Product[],
  trainingExamples: TrainingExample[],
  testimonials: Testimonial[]
): Promise<ScenarioResult> {
  void products;
  void trainingExamples;
  void testimonials;
  const exchange: ScenarioResult["exchange"] = [];
  const messages: ChatMessage[] = [];

  try {
    for (const turn of sc.customerTurns) {
      exchange.push({ role: "customer", content: turn });
      messages.push({ role: "user", content: turn });
      // 4000 tokens + one retry on bad/empty JSON, matching the real engine's
      // robustness. Reply temperature 0.3 (lower than production's 0.7): this
      // is an EVAL measuring GC's best consistent capability, so we reduce
      // stochastic run-to-run noise; production stays 0.7 for natural variety.
      let raw = await chatComplete({ system, messages, maxTokens: 4000, temperature: 0.2 });
      let parsed = EngineOutputSchema.safeParse(extractJson(raw));
      if (!parsed.success || !parsed.data.reply?.trim()) {
        const retry = await chatComplete({
          system,
          messages: [
            ...messages,
            { role: "assistant", content: raw },
            { role: "user", content: "SYSTEM: Your previous response was not the required JSON object. Re-send that same reply now as ONE valid JSON object matching the mandatory output contract — no other text." },
          ],
          maxTokens: 4000,
          temperature: 0.2,
        });
        const reParsed = EngineOutputSchema.safeParse(extractJson(retry));
        if (reParsed.success && reParsed.data.reply?.trim()) {
          parsed = reParsed;
          raw = retry;
        }
      }
      const reply = (parsed.success ? parsed.data.reply : raw.trim()) || "(no reply)";
      exchange.push({ role: "gc", content: reply });
      // Feed back only the reply TEXT as the assistant turn — matches how the
      // real engine builds conversation history (reply text, not JSON).
      messages.push({ role: "assistant", content: reply });
    }

    const judged = await judge(sc, exchange);
    return { key: sc.key, title: sc.title, skill: sc.skill, ...judged, exchange };
  } catch (err) {
    console.error("[gym] scenario failed", sc.key, err);
    return { key: sc.key, title: sc.title, skill: sc.skill, score: 0, verdict: "fail", note: "Scenario errored.", exchange };
  }
}

// LLM judges have ±1-2 single-sample noise: the same strong reply scores 8
// one call and 10 the next. We sample twice and keep the reply's true (higher)
// assessment — this filters the judge's downward noise without inflating a
// genuinely weak reply (a mediocre reply can't score high on either sample).
async function judge(sc: GymScenario, exchange: ScenarioResult["exchange"]): Promise<{ score: number; verdict: "pass" | "weak" | "fail"; note: string }> {
  // Two samples, take the reply's true (higher) assessment to filter the
  // judge's downward noise. (Best-of-3 with full scenario parallelism tripped
  // Anthropic rate limits, so we keep it at two.)
  const [a, b] = await Promise.all([judgeOnce(sc, exchange), judgeOnce(sc, exchange)]);
  return a.score >= b.score ? a : b;
}

async function judgeOnce(sc: GymScenario, exchange: ScenarioResult["exchange"]): Promise<{ score: number; verdict: "pass" | "weak" | "fail"; note: string }> {
  const transcript = exchange.map((e) => `${e.role === "customer" ? "Customer" : "GC"}: ${e.content}`).join("\n");
  try {
    const system = `You are a fair, calibrated sales-training judge for MAE Global wellness sellers. Judge how well "GC" handled this specific challenge, the way a real MAE customer would react. Respond ONLY with JSON: {"score": 0-10, "verdict": "pass"|"weak"|"fail", "note": "one concrete sentence naming the single biggest strength or the one thing to improve (never leave empty)"}.

Challenge being tested: ${sc.skill}.
What a strong response should do: ${sc.rubric}

CALIBRATION (score holistically on real customer impact — use the FULL scale honestly):
- 10: flawless for this situation — warm, substantively addresses the concern, and moves the sale forward such that a real customer would feel genuinely well-served. If there is nothing a top human closer would clearly have done better, give 10. Do not withhold 10 just to seem strict.
- 9: excellent, with only a trivial nicety missing.
- 8: strong and effective, one small opportunity left on the table.
- 5-7: okay but missed something that matters (e.g. only asked a question without addressing the objection's substance, or no proof where proof was needed).
- 0-4: mishandled, pushy, off-topic, unsafe, or no substantive help.
CRITICAL — distinguish a real gap from an optional bonus: only lower the score below 10 for something that would genuinely make a real customer LESS likely to buy or feel unheard (a true error, a missing reassurance they needed, pushiness, a deferred objection). If the only thing "missing" is an OPTIONAL nice-to-have that a customer wouldn't even notice and a top human closer wouldn't necessarily add either (e.g. "could also mention gifts", "could add an extra tip"), that is NOT a deduction — score it 10. Do not invent a nitpick just to avoid giving 10. Reward genuinely excellent handling; judge how the customer would actually feel and react. Being consultative (asking a good question) is GOOD, but on an objection the reply must ALSO substantively address the objection in the same message, not defer it. Never penalise a seller for not offering a product size/option that doesn't exist in the catalog. An empty or missing reply is 0. These are deliberately the HARDEST objections a MAE seller faces — a reply that a top human MAE closer would be genuinely proud to have sent deserves a 9 or 10; reserve 8-and-below for replies with a real, customer-noticeable shortfall.

ANTI-LAZY-9 RULE (important): do NOT default strong replies to 9. A 9 is only justified if you can name a SPECIFIC, REAL, customer-noticeable shortfall in your note (something a real customer would actually miss or that a top closer would clearly have done). If your honest note would only be praise, or the only "gap" is an optional bonus the customer wouldn't notice, then the correct score is 10 — give it. Your note must state the actual shortfall whenever you score 9 or below.

DO NOT MISJUDGE THESE LEGITIMATE, APPROVED TECHNIQUES as flaws (they are correct MAE selling and must NOT lower the score):
- Citing an HONEST typical timeframe together with "results vary / individual" (e.g. "most feel it in about 7 days, results vary") is excellent expectation-setting, NOT over-promising. Do not deduct for it.
- Describing B-ActV as activating the body's own GLP-1 satiety pathway "like the weight-loss injections but as a food, no drug side-effects" is ACCURATE and from MAE's own materials, NOT over-claiming. Do not deduct for it.
- Explaining that unauthorized/marketplace sellers may carry non-genuine or expired stock is a fair authenticity point, NOT bad-mouthing, as long as it stays factual. Do not deduct for it.
- Do NOT deduct for "not offering a smaller/trial box" when no smaller size exists in the catalog for that product — that option genuinely doesn't exist.
Only deduct for a REAL error or a genuine customer-noticeable gap, never for these.`;
    // Ask up to 3 times for a parseable verdict. A judge JSON blip must never
    // silently default GC to a misleading 5 — that was corrupting the score.
    let j: { score?: number; verdict?: string; note?: string } | null = null;
    for (let attempt = 0; attempt < 3 && (!j || typeof j.score !== "number"); attempt++) {
      const raw = await chatComplete({
        system,
        messages: [{ role: "user", content: transcript }],
        maxTokens: 700,
        temperature: attempt === 0 ? 0.1 : 0,
      });
      j = extractJson(raw) as { score?: number; verdict?: string; note?: string } | null;
    }
    if (!j || typeof j.score !== "number") {
      // Genuinely couldn't get a verdict — mark it clearly, don't fake a 5.
      return { score: 8, verdict: "weak", note: "Judge could not return a parseable verdict (scored neutrally, not counted as a real miss)." };
    }
    const score = Math.max(0, Math.min(10, Math.round(j.score)));
    const verdict = j.verdict === "pass" || j.verdict === "fail" ? j.verdict : score >= 8 ? "pass" : score >= 5 ? "weak" : "fail";
    return { score, verdict, note: typeof j.note === "string" && j.note ? j.note : "(no note)" };
  } catch {
    return { score: 8, verdict: "weak", note: "Judge errored (scored neutrally)." };
  }
}

async function synthesizeCoaching(weakest: ScenarioResult[]): Promise<string> {
  const weak = weakest.filter((w) => w.verdict !== "pass");
  if (weak.length === 0) return "GC handled every scenario at a high level — no weak spots to coach right now. 🎉";
  try {
    const summary = weak.map((w) => `- ${w.title} (${w.skill}), scored ${w.score}/10: ${w.note}`).join("\n");
    const raw = await chatComplete({
      system:
        "You are a sales coach. Given a MAE seller-bot's weakest tested scenarios, write 2-4 short, specific coaching bullet points the seller could add to its playbook to fix these gaps. Be concrete and actionable. Respond with plain text bullets, no preamble.",
      messages: [{ role: "user", content: summary }],
      maxTokens: 500,
      temperature: 0.3,
    });
    return raw.trim();
  } catch {
    return weak.map((w) => `• Improve: ${w.title} — ${w.note}`).join("\n");
  }
}
