import Anthropic from "@anthropic-ai/sdk";
import { extractJson } from "@/lib/ai/llm";

export type PaymentVerification = {
  looksLikePaymentProof: boolean;
  extractedAmount: number | null; // MYR
  extractedRecipient: string | null;
  recipientMatchesStore: boolean;
  confidence: number; // 0-1
  reasoning: string;
};

const VERIFICATION_THRESHOLD = 0.85;
// Bank apps sometimes show "RM244.00" vs an order total of 244 — allow only
// sub-ringgit rounding noise, nothing more.
const AMOUNT_TOLERANCE_MYR = 0.5;

// The auto-confirm gate. Unlike Mandy (which had no exact expected price and
// deliberately skipped amount-matching), an ecommerce order has an exact
// total — so the amount match is a HARD requirement here, on top of the
// recipient match and the confidence threshold. All three in plain code,
// never inside the prompt.
export function isConfidentPaymentMatch(v: PaymentVerification, expectedAmountMyr: number | null): boolean {
  if (expectedAmountMyr == null || expectedAmountMyr <= 0) return false; // no known total → never auto-confirm
  return (
    v.looksLikePaymentProof &&
    v.recipientMatchesStore &&
    v.extractedAmount != null &&
    Math.abs(v.extractedAmount - expectedAmountMyr) <= AMOUNT_TOLERANCE_MYR &&
    v.confidence >= VERIFICATION_THRESHOLD
  );
}

// Deliberately isolated from chatComplete() in llm.ts — this is a
// fundamentally different structured task (image-in, JSON-verdict-out). This
// never mutates any money state itself; it only returns a structured verdict
// that the caller checks against the fixed threshold above.
//
// Anthropic-only (this project's default provider). Best-effort: never
// throws — any failure returns null so the caller always has a clean
// "couldn't verify" fallback to human review.
export async function verifyPaymentProof(opts: {
  imageData: Uint8Array;
  mimeType: string;
  paymentMethods: string;
  paymentInstructions: string;
  expectedAmountMyr: number | null;
}): Promise<PaymentVerification | null> {
  const provider = process.env.LLM_PROVIDER || "anthropic";
  if (provider !== "anthropic" || !process.env.ANTHROPIC_API_KEY) return null;

  const mediaType = opts.mimeType as "image/jpeg" | "image/png" | "image/webp";
  if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) return null;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const model = process.env.GC_LLM_MODEL || "claude-sonnet-5";
    const base64Data = Buffer.from(opts.imageData).toString("base64");

    const res = await client.messages.create({
      model,
      max_tokens: 1024,
      system:
        'You verify payment-proof screenshots for an ecommerce store\'s order system. You are called by software, not a person — respond with EXACTLY one JSON object, nothing else: {"looksLikePaymentProof": boolean, "extractedAmount": number|null, "extractedRecipient": string|null, "recipientMatchesStore": boolean, "confidence": number between 0 and 1, "reasoning": "short explanation"}. "extractedAmount" is the MYR amount visible in the image (numeric, no currency symbol), or null if unreadable. "extractedRecipient" is the recipient name/bank account/e-wallet id visible in the image, or null if unreadable. "recipientMatchesStore" must be true ONLY if the recipient visible in the image clearly matches the store\'s own configured payment details given below — a mismatch, or any uncertainty, must be false. Report the amount exactly as shown; do NOT decide yourself whether it is the "right" amount — the system compares it against the order total separately. Be conservative: this decides whether an order gets auto-confirmed without human review, so when in doubt, lower your confidence rather than guessing favorably.',
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
            {
              type: "text",
              text: `The store's configured payment methods:\n${opts.paymentMethods || "(not configured)"}\n\nThe store's configured payment instructions (may include the exact recipient name/account):\n${opts.paymentInstructions || "(not configured)"}\n\n${opts.expectedAmountMyr != null ? `For context, the order total on file is RM${opts.expectedAmountMyr} — still report the amount you actually see, even if different.` : ""}\n\nDoes this screenshot show a genuine payment to this store? Respond with the JSON object only.`,
            },
          ],
        },
      ],
    });

    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;

    const parsed = extractJson(block.text) as Partial<PaymentVerification> | null;
    if (!parsed || typeof parsed.confidence !== "number") return null;

    return {
      looksLikePaymentProof: Boolean(parsed.looksLikePaymentProof),
      extractedAmount: typeof parsed.extractedAmount === "number" ? parsed.extractedAmount : null,
      extractedRecipient: typeof parsed.extractedRecipient === "string" ? parsed.extractedRecipient : null,
      recipientMatchesStore: Boolean(parsed.recipientMatchesStore),
      confidence: parsed.confidence,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    };
  } catch (err) {
    console.error("[vision] verifyPaymentProof failed (non-fatal)", err);
    return null;
  }
}
