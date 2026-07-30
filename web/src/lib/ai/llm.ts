import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// Provider-agnostic chat completion. Default: Anthropic Claude.
// Switch with LLM_PROVIDER=openai. Model override: GC_LLM_MODEL.

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function llmConfigured(): boolean {
  const provider = process.env.LLM_PROVIDER || "anthropic";
  return provider === "openai"
    ? Boolean(process.env.OPENAI_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function chatComplete(opts: {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  // Lets the model search the web (Anthropic server-side tool) — used so GC
  // can answer competitor-product questions with real, current facts instead
  // of refusing or guessing. No-op on the OpenAI provider.
  webSearch?: boolean;
}): Promise<string> {
  const provider = process.env.LLM_PROVIDER || "anthropic";
  const maxTokens = opts.maxTokens ?? 1024;
  const temperature = opts.temperature ?? 0.7;

  if (provider === "openai") {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.GC_LLM_MODEL || "gpt-4o";
    const res = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
    });
    return res.choices[0]?.message?.content ?? "";
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.GC_LLM_MODEL || "claude-sonnet-5";

  const tools = opts.webSearch
    ? [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 3 }]
    : undefined;

  // With server-side tools the API can pause its internal loop
  // (stop_reason "pause_turn") — re-send with the partial assistant turn
  // appended and it resumes automatically.
  const anthropicMessages: Anthropic.MessageParam[] = opts.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  // The system prompt is ~37k tokens and identical on every turn, so it is sent
  // as a cacheable block. Without this each customer message re-pays full input
  // price for the entire catalogue, proof library and playbook — which is what
  // exhausted the API credit. Cache hits bill at a small fraction of that.
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: opts.system, cache_control: { type: "ephemeral" } },
  ];

  let res = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: anthropicMessages,
    ...(tools ? { tools } : {}),
  });
  let continuations = 0;
  while (res.stop_reason === "pause_turn" && continuations < 3) {
    anthropicMessages.push({ role: "assistant", content: res.content });
    res = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: anthropicMessages,
      ...(tools ? { tools } : {}),
    });
    continuations++;
  }

  // With web search the response interleaves text with server_tool_use /
  // web_search_tool_result blocks and may contain several text blocks —
  // concatenate them all (the JSON contract extractor scans the whole thing).
  const u = res.usage as { cache_read_input_tokens?: number; cache_creation_input_tokens?: number; input_tokens?: number };
  if (process.env.GC_LOG_USAGE) {
    console.log(
      `[llm] in=${u.input_tokens ?? 0} cacheRead=${u.cache_read_input_tokens ?? 0} cacheWrite=${u.cache_creation_input_tokens ?? 0}`
    );
  }

  const texts = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
  if (texts.length === 0) {
    console.error(
      "[llm debug] no text block — stop_reason:", res.stop_reason,
      "content types:", res.content.map((b) => b.type),
      "usage:", JSON.stringify(res.usage)
    );
    return "";
  }
  return texts.map((b) => b.text).join("\n");
}

// Extracts the first JSON object from a model response (handles ```json fences
// and leading/trailing prose).
export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) return null;
  // Walk to the matching closing brace.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
