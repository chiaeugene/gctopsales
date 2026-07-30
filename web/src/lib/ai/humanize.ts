// Deterministic reply scrubber: GC must never send AI-looking dash
// punctuation (em dash —, en dash –, double hyphen --, spaced " - ",
// leading "-" bullets). The prompt forbids them too, but this runs on EVERY
// outgoing reply so the guarantee doesn't depend on the model listening.
//
// What it deliberately preserves:
// - hyphens inside words/codes:   B-ActV, SET2BC, Touch-n-Go, 012-3456789
// - tight numeric ranges:         1-2 days, RM100-RM150
// (only *punctuation* dashes are rewritten)

const CJK = /[一-鿿㐀-䶿豈-﫿぀-ヿ]/;

// Every dash-like char the model uses as punctuation.
const DASH_CHARS = "—–―−－"; // — – ― − －

function separatorFor(before: string, after: string): string {
  // Chinese/Japanese context gets a full-width comma, everything else ", ".
  if (CJK.test(before) || CJK.test(after)) return "，"; // ，
  return ", ";
}

// Splits a reply into separate WhatsApp bubbles on blank lines, the way a real
// person texts (several short messages instead of one wall). Research on
// WhatsApp response rates is blunt about this: replies under ~100 characters
// get the most engagement, long paragraphs get skimmed, and Meta throttles
// senders whose messages don't earn replies — so shape affects deliverability,
// not just conversion.
const MAX_BUBBLES = 3;

export function splitIntoBubbles(text: string): string[] {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return [];

  const parts = trimmed
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [trimmed];

  const bubbles: string[] = [];
  for (const part of parts) {
    // Trailing scraps ("Ok?", a lone emoji) ride along with the previous
    // bubble rather than becoming their own ping. Kept low so a meaningful
    // short line — a price, a one-line question — still stands alone.
    if (bubbles.length && (part.length < 15 || bubbles.length >= MAX_BUBBLES)) {
      bubbles[bubbles.length - 1] += `\n${part}`;
    } else {
      bubbles.push(part);
    }
  }
  return bubbles;
}

export function humanizeReply(text: string): string {
  if (!text) return text;
  let out = text;

  // 1. Leading list bullets ("- item", "— item", "* item") → "• item".
  out = out.replace(/^[ \t]*[-*—–―][ \t]+/gm, "• ");

  // 2. Dashes between digits collapse to a plain tight hyphen (ranges):
  //    "1 — 2", "1 -- 2", "1 - 2" → "1-2", "RM100 — RM150" → "RM100-RM150".
  out = out.replace(
    new RegExp(
      `(\\d)[ \\t]*(?:[${DASH_CHARS}]|-{2,}|-)[ \\t]*((?:RM|MYR|SGD|BND|USD|S\\$|B\\$|\\$)?[ \\t]?\\d)`,
      "gi"
    ),
    "$1-$2"
  );

  // 3. Em/en dashes and double hyphens used as punctuation → comma (or CJK comma).
  out = out.replace(
    new RegExp(`[ \\t]*(?:[${DASH_CHARS}]|-{2,})[ \\t]*`, "g"),
    (match, offset: number, full: string) => {
      const before = full[offset - 1] ?? "";
      const after = full[offset + match.length] ?? "";
      // Dash at start/end of a line: just drop it.
      if (!before || !after || before === "\n" || after === "\n") return " ";
      return separatorFor(before, after);
    }
  );

  // 4. Spaced single hyphen as a clause separator: "text - text" → "text, text".
  //    (digit-digit was already collapsed in step 2.)
  out = out.replace(/(\S)[ \t]+-[ \t]+(\S)/g, (_m, a: string, b: string) => {
    return `${a}${separatorFor(a, b)}${b}`;
  });

  // 5. Cleanup artifacts.
  out = out
    .replace(/[ \t]+,/g, ",") // "word ,": stray space before comma
    .replace(/,{2,}/g, ",") // ",,"
    .replace(/, ([.,!?])/g, "$1") // ", ." / ", !"
    .replace(/，{2,}/g, "，") // ，，
    .replace(/，[ \t]+/g, "，") // "， " → "，"
    .replace(/[ \t]{2,}/g, " "); // double spaces

  return out;
}
