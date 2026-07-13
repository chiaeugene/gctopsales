# Architecture reference: what Mandy is, and how to rebuild this pattern for a new industry

This document explains, in detail, the AI sales-assistant system built for "Mandy" (a wedding-photography sales chatbot) so it can be rebuilt for a different domain — in this case, ecommerce. It covers the *why* behind every major decision, not just the *what*, because the reasoning is what actually transfers between industries.

The companion `reference/` folder contains verbatim copies of the source files this document discusses. Files ending in `.example` are domain-specific (wedding content) — read them for the *pattern*, not the content. Everything else in `reference/lib/` is close to industry-agnostic already.

---

## 1. Core philosophy (this is the part that must not change)

**The AI suggests. Code decides.** Every single response from the language model is treated as an *untrusted proposal*, never a command. A separate, deterministic layer of plain TypeScript reads the model's structured output and decides what — if anything — actually gets written to the database. This single principle is why the system has never (after early bugs were fixed) taken an unrecoverable wrong action despite months of real customer traffic.

Concretely, this shows up in three ways:

1. **Strict JSON output contract.** The model never gets to just "talk" — every single turn must return a JSON object with a fixed shape (see §3). If it doesn't, the code detects that as a contract violation and retries/degrades rather than passing broken output through.
2. **Whitelisted state transitions.** The model can *suggest* a new status for a lead/order, but a hardcoded whitelist decides which suggestions are even eligible to apply automatically. Certain states (see §4) can **only** be entered by a deliberate, separate code path — never by the model's free-form suggestion.
3. **Deterministic side-effect code, not prompted behavior.** Whenever something the model does needs to have a real-world consequence (create a calendar event, confirm a payment, send a file), that consequence is implemented as plain code triggered by a specific field in the model's output — never left as "the model will remember to call the right function."

If you take one thing from this whole document into the ecommerce rebuild, take this: **decide up front which actions are irreversible/financial, and make those require either an explicit human action or a very narrow, independently-verified automatic path — never a bare LLM judgment call.**

---

## 2. Multi-tenant data model

Every table that holds business data carries a `profileId` (the tenant, e.g. one wedding studio or one ecommerce store) and every single query is scoped by it. There is no shared/global data. `src/lib/tenant.ts` (`reference/lib/tenant.ts`) is the one place that resolves "who is logged in" into a tenant record:

```ts
export async function requireProfile(): Promise<PhotographerProfile> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new UnauthorizedError();
  const profile = await prisma.photographerProfile.findUnique({ where: { userId } });
  if (!profile) throw new UnauthorizedError();
  return profile;
}
```

Every API route calls this first, then uses `profile.id` in every subsequent query's `where` clause. There is no other access path. For ecommerce, rename `PhotographerProfile` → `StoreProfile` (or similar) but keep this exact shape: one row per tenant, one `userId` foreign key, one function that's the sole entry point.

### The "brain" pattern — four JSON blobs, not a monolithic config table

Instead of one config table with fifty columns, the tenant's entire behavioral configuration is split into a small number of purpose-specific JSON blobs stored as `String` columns on the profile row, each validated by a Zod schema (`src/lib/ai/schemas.ts`):

```ts
export const BrandBrainSchema = z.object({
  photographerName: z.string().default(""),
  studioName: z.string().default(""),
  // ... more identity/voice fields
}).partial().default({});

export const SalesBrainSchema = z.object({
  discountRules: z.string().default(""),
  followUpRules: z.string().default(""),
  salesPressure: z.string().default("balanced"),
  // ...
}).partial().default({});

export const BookingBrainSchema = z.object({
  depositAmount: z.string().default(""),
  paymentMethods: z.string().default(""),
  // ...
}).partial().default({});
```

Every field is `z.string().default("")`, and the whole object is `.partial()`. This is deliberate: **an empty or half-filled brain must never crash prompt construction.** A brand-new tenant with zero configuration gets a working (if generic) bot immediately; each field they fill in just adds one more line to the compiled prompt.

For ecommerce, the four brains become (suggested):
- **Identity Brain**: store name, category, tone, language style — same shape as Brand Brain.
- **Sales/Support Brain**: discount rules, escalation style, upsell rules — same shape as Sales Brain.
- **Fulfillment Brain**: payment methods, shipping policy, return/refund policy, order-verification rules — analogous to Booking Brain (deposit/payment fields map almost directly; "consultation call rules" doesn't apply, "cancellation policy" does).
- **Catalog Rules**: a small blob for cross-cutting pricing rules (shipping fee rules, bulk-discount rules) — analogous to Package Rules (travel fee/overtime fee rules).

**Why this design over one big settings table:** (a) it lets the AI prompt builder just concatenate "only the non-empty lines" without touching a database migration every time you add a configurable behavior; (b) it lets you version/AB-test a whole personality by swapping one JSON blob; (c) an "AI-led setup interview" (see §9) can fill these in conversationally without needing bespoke UI per field.

### BLOB/attachment storage discipline (learned the hard way — read this carefully)

Two separate production OOM crashes happened this session, both from the same root mistake: loading a `Bytes` (BLOB) column when only metadata was needed. The fix pattern, now used everywhere:

```ts
// src/lib/attachments.ts
export type AttachmentMetadata = Omit<PackageAttachment, "data">;

export function serializeAttachment(a: AttachmentMetadata) {
  return { id: a.id, fileName: a.fileName, /* ...metadata only... */, url: `/api/attachments/${a.id}` };
}
```

**The rule: every list/chat/prompt-building query uses `omit: { data: true }` (or an explicit `select` that excludes it). The *only* place that ever loads the real bytes is a single dedicated byte-serving route** (`src/app/api/attachments/[id]/route.ts`), which fetches exactly one row and streams it:

```ts
export async function GET(_req, { params }) {
  const attachment = await prisma.packageAttachment.findFirst({ where: { id, profileId: profile.id } });
  return new NextResponse(new Uint8Array(attachment.data), { headers: { "Content-Type": attachment.mimeType, ... } });
}
```

This exact pattern is duplicated for **inbound** (customer-uploaded) attachments too, as a *separate* table (`InboundAttachment`, not reusing the outbound one — different owner, different lifecycle): `src/lib/inbound-attachments.ts` / `src/app/api/inbound-attachments/[id]/route.ts`. When sending a batch of attachments (e.g. over WhatsApp), load them **one at a time in a loop**, never `findMany` with the bytes included — see `sendWhatsAppAttachmentsByIds` in `reference/lib/whatsapp/client.ts`.

For ecommerce: product images, order-proof-of-payment screenshots (very likely to recur — see §7), and any customer-uploaded return/complaint photos should all follow this exact split.

---

## 3. The AI engine pipeline (the heart of the system)

`src/lib/ai/engine.ts`'s `generateMandyReply()` is the single function every channel (test playground, WhatsApp webhook) calls to get a reply. Full flow:

1. **Guard**: if the lead/order is already flagged `needsHuman`, refuse to auto-reply at all (`throw`). This is enforced at the lowest level, not just in the UI — a frozen conversation cannot accidentally get an AI reply from any code path.
2. **Fetch context in parallel** (`Promise.all`): active catalog/packages (metadata only, per §2), a small number of "training examples" (see §9), and the last N messages of conversation history.
3. **Fetch availability/scheduling context** if relevant (optional layer, see §7) — wrapped in try/catch, never blocks the reply on failure.
4. **Compile the system prompt** — a pure, synchronous function (`buildMandySystemPrompt`) that takes all the fetched data and returns one big string. No I/O inside it. This matters: keeping prompt-building side-effect-free makes it independently testable (you can literally print the exact prompt for a given input and read it, which is how several bugs in this session were verified).
5. **Convert history into the LLM's message format**, merging consecutive same-role turns (important: a human-takeover period can produce several customer messages in a row with no bot reply between them — the LLM API requires alternating roles).
6. **Call the model** (`chatComplete`).
7. **Parse strict JSON out of the response** (`extractJson` — brace-matching JSON extractor tolerant of markdown code fences and stray prose). **If parsing fails, retry once** with the bad output shown back to the model and an explicit "that wasn't valid JSON, resend it as JSON" instruction. This single retry recovers the overwhelming majority of contract violations without needlessly freezing the conversation.
8. **If it still fails after retry**, degrade gracefully: use the raw text as the reply, but force low confidence so the guardrail layer treats it as needing human attention. **Never crash, never leave the customer with literally nothing.**
9. **Filter any "send this attachment" ids against a tenant-ownership whitelist** — the model can request an attachment by id, but the code independently verifies that id actually belongs to this tenant's active catalog before honoring it. The model cannot leak another tenant's files by inventing/guessing an id.
10. **Apply guarded side effects** (`applyEngineEffects` — see §4) and return.

### The output contract

Every single model turn must return exactly this shape (see `EngineOutputSchema` in `reference/lib/ai/schemas.ts`):

```ts
{
  reply: string,                 // the only field the customer ever sees
  detectedLanguage: "en"|"zh"|"ms"|"mixed",
  extracted: {                    // NEW facts learned this turn only, null otherwise
    customerName, eventDate, eventTime, location, eventType, budgetRange, interestedPackage
  },
  suggestedStatus: string | null,   // the model's opinion on pipeline stage — not authoritative
  takeover: { needed: boolean, reason: string | null },
  confidence: number,             // 0-1
  sendAttachmentIds: string[],
}
```

For ecommerce, `extracted` becomes something like `{ customerName, orderNumber, productSku, issueType, desiredResolution }`, and `suggestedStatus` maps to your order/ticket pipeline stages. The *shape* — a customer-facing reply plus a machine-readable sidecar of extracted facts, confidence, and an explicit escalation flag — is what to keep.

**Why `confidence` and `takeover` are separate concerns from `reply`:** a model can produce a perfectly fluent, convincing reply while being *wrong* or *out of its depth*. Making it self-report a confidence score and an explicit "I think a human should look at this" flag, independently of how good the prose reads, is what lets the code layer catch cases the model itself flags as risky — `confidence < 0.4` forces a takeover regardless of what `takeover.needed` says.

---

## 4. Guardrails: the whitelist pattern and the money-state lesson

`applyEngineEffects()` is the *only* place the model's output is translated into database writes. Read it in full — `reference/lib/ai/engine.ts`. Key structure:

```ts
const MONEY_STATES: LeadStatus[] = ["Deposit Paid", "Booked"];

export async function applyEngineEffects(profile, lead, output) {
  const data = {};
  // 1. Fill blank facts only — never overwrite a human's manual edit.
  if (ex.eventDate && !lead.eventDate) data.eventDate = ex.eventDate;

  // 2. Status changes are WHITELISTED, and money states are protected on BOTH sides.
  const inMoneyState = MONEY_STATES.includes(lead.status);
  if (takeover) {
    data.needsHuman = true;
    data.takeoverReason = ...;
    if (!inMoneyState) data.status = "Human Takeover Needed";   // <-- protect on write
  } else if (suggested && AI_ALLOWED_STATUSES.includes(suggested) && !inMoneyState) {
    data.status = suggested;                                     // <-- protect on write
  }
  ...
}
```

**The bug that taught this lesson**: originally, only the second branch (`suggestedStatus`) protected money states from being overwritten. The *takeover* branch didn't — so a lead that had already been paid and booked could later have an unrelated AI reply trigger a takeover (e.g. "let me check with the photographer about a request"), and that takeover branch would unconditionally stamp `status = "Human Takeover Needed"`, silently erasing the fact that the booking was paid and confirmed. **Any code path that can write a status field needs the same protection check, not just the "obvious" one.** When designing the ecommerce version's guardrail, audit *every* branch that writes to a protected field, not just the one that looks most dangerous at a glance.

**A money state can only be *entered* through one narrow path**, never through the general AI-suggestion mechanism at all:

```ts
// src/lib/leads/confirm-deposit.ts
export async function applyLeadEdit(profile, lead, data) {
  if (data.depositStatus === "CONFIRMED" && !data.status) data.status = "Booked";
  await syncGoogleCalendarOnLeadUpdate(profile, lead, data);   // side effect lives here too
  return prisma.lead.update({ where: { id: lead.id }, data });
}
export async function confirmDepositAndBook(profile, lead) {
  return applyLeadEdit(profile, lead, { depositStatus: "CONFIRMED" });
}
```

This one function is called from exactly two places: (a) the photographer's manual PATCH endpoint, and (b) the one narrow AI-vision auto-confirm path described in §7. **Nowhere else in the codebase is allowed to set `depositStatus`/`status` to a money state.** That's an actual invariant enforced by code organization (there's only one function that does it, and it's small enough to audit by reading it once), not just a comment.

For ecommerce: the equivalent money states are things like "Payment Confirmed" / "Order Fulfilled" / "Refund Issued". Build the same single-choke-point function before you build anything that might try to set those fields from five different places.

---

## 5. Multi-channel messaging: one core, N thin adapters

`src/lib/webhooks/inbound.ts`'s `handleInboundMessage()` is the channel-agnostic core. A channel adapter's entire job is: turn its native payload into this function's generic input shape, and turn its output back into a channel-native reply.

```ts
export async function handleInboundMessage(opts: {
  profile, source, externalContactId, externalMessageId, customerMessage
}): Promise<{ reply, attachmentIds } | null> {
  // 1. Dedupe: webhook providers redeliver aggressively. Never process the
  //    same externalMessageId twice.
  if (await prisma.message.findUnique({ where: { externalId: opts.externalMessageId } })) return null;

  // 2. Find-or-create the lead/conversation for this external contact.
  const lead = await findOrCreateLeadForInbound(profile, source, externalContactId);

  // 3. If already frozen for human review, just record the message silently
  //    — no AI reply, but the conversation history stays complete.
  if (lead.needsHuman) { await prisma.message.create({...}); return null; }

  // 4. Otherwise, run the full engine pipeline (same one Playground uses).
  const { output, lead: updated, attachmentIds } = await generateMandyReply({...});
  await recordExchange({...});
  return { reply: output.reply, attachmentIds };
}
```

The **Playground** (an in-app "pretend to be the customer" test harness — extremely valuable for both development and giving the tenant confidence in the bot before connecting it to a real channel) calls the exact same `generateMandyReply`/`recordExchange` pipeline directly, without going through `handleInboundMessage` (it doesn't need dedup or find-or-create, since a Playground session's lead already exists). Building a Playground-equivalent early, before wiring up any real channel, is what let this entire project be developed and demoed without a single real customer message for weeks.

The **WhatsApp webhook** (`src/app/api/webhooks/whatsapp/route.ts`) is the thinnest possible adapter: verify the request signature, extract `{from, id, text.body}`, call `handleInboundMessage`, send the reply back via `sendWhatsAppText`. Three things in this file matter beyond the obvious:

1. **Body-size cap before signature verification.** This webhook is the one endpoint on the internet reachable by literally anyone before any auth check runs (Meta hasn't verified yet at that point). An earlier version read the full body with `req.text()` unconditionally — any attacker could POST an arbitrarily large body and OOM-crash the server. Fixed by streaming the body in with a hard byte cap (256KB), rejecting oversized payloads before they're ever fully buffered into memory.
2. **Always return 200 fast.** Meta retries aggressively on non-200/slow responses, which causes duplicate processing. Every per-message step is wrapped in try/catch so one bad message never blocks the batch's final 200 response.
3. **Non-text message types get a graceful, deterministic fallback** (`recordUnhandledInboundMessage` — sets the lead to human-takeover with a clear internal note) — **except image messages**, which get their own real handling (§6), since "customer sends a photo" turned out to be common and important enough to deserve first-class support rather than the generic fallback.

For ecommerce, add channel adapters the same way: thin, dumb translation layers around the same `generateMandyReply`/`handleInboundMessage` core. Instagram DM, live-chat widget, email — all the same shape.

---

## 6. Inbound images: a deterministic, non-AI-vision-by-default path

Customers sending photos (most commonly: payment-proof screenshots) is universal across booking businesses and ecommerce alike (bank transfer / COD proof is extremely common in Malaysia-style commerce). The default handling is **deliberately not AI vision** — an image never reaches the sales LLM (`generateMandyReply`) at all. It's handled by dedicated, deterministic code:

```ts
// src/lib/webhooks/inbound.ts
export async function recordInboundImageMessage(opts: { profile, lead, inboundAttachmentId, caption? }) {
  // dedupe, ensure conversation exists (same as handleInboundMessage)
  await prisma.message.create({ data: { role: "CUSTOMER", content: caption || "[Image attached]", inboundAttachmentIds: JSON.stringify([id]) } });
  if (lead.needsHuman) return null;   // already mid-review, don't repeat the ack

  // opt-in vision verification (see below) — falls through to human handoff
  // by default
  if (profile.autoConfirmPayments) {
    const verified = await verifyAndMaybeConfirm(...);
    if (verified) return verified;
  }

  // default: hand to human with a warm acknowledgment, not silence
  await prisma.lead.update({ data: { needsHuman: true, status: "Human Takeover Needed", takeoverReason: "..." } });
  await prisma.message.create({ data: { role: "MANDY", content: "Thanks for sending this! I've forwarded it to ${photographer} to verify — they'll confirm shortly 😊" } });
  return { ackReply };
}
```

Both the WhatsApp webhook (downloading the actual media bytes via Meta's two-step Graph API — media id → temporary URL → bytes) and the Playground (a real upload button) feed this same function. **The customer is never left with silence** — even the "can't process this" path returns a warm, human acknowledgment, because leaving a customer's payment screenshot unanswered is a real trust/conversion problem, not just a UX nicety.

### The opt-in AI-vision auto-confirm exception (read this section before copying it — it's the one place the "no LLM controls money" rule is deliberately bent)

The tenant can opt into (`profile.autoConfirmPayments`, default `false`) having Claude's vision capability inspect a payment screenshot and, if it's a *confident, unambiguous match*, auto-confirm the payment and booking without waiting for a human. This was an explicit, informed choice by the business owner after being told the risk directly (fake/edited screenshots, wrong amount, wrong recipient, misreading a blurry photo) — **do not build this without the same explicit conversation with whoever owns the ecommerce business risk.**

The safety design, if you do build it:

```ts
// src/lib/ai/vision.ts
export async function verifyPaymentProof(opts): Promise<PaymentVerification | null> {
  // separate, isolated Anthropic call — NOT routed through the general chat
  // pipeline, because this is a fundamentally different task (image-in,
  // structured-verdict-out) and isolating it means zero risk to the
  // already-working text pipeline if something about vision calls changes.
  const res = await client.messages.create({
    model, max_tokens: 1024,
    system: `... respond with EXACTLY one JSON object: {looksLikePaymentProof, extractedAmount, extractedRecipient, recipientMatchesStudio, confidence, reasoning} ... Be conservative: this decides whether a booking gets auto-confirmed without human review, so when in doubt, lower your confidence rather than guessing favorably.`,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type, data: base64Data } },
      { type: "text", text: `Studio's configured payment details: ${paymentMethods}\n${paymentInstructions}\n\nDoes this match?` },
    ]}],
  });
  // never throws — any failure returns null, which the caller treats as
  // "couldn't verify" and falls through to human review
}

export function isConfidentPaymentMatch(v) {
  return v.looksLikePaymentProof && v.recipientMatchesStudio && v.extractedAmount != null && v.confidence >= 0.85;
}
```

Notice what this checks and what it deliberately does **not** try to check: it verifies the *recipient* (name/account/e-wallet id visible in the screenshot) against the business's own configured payment details — this is the single most fraud-relevant, and most reliably-checkable-from-an-image, signal. It does **not** try to hard-match the amount against "what this specific order/booking should cost", because in this system there was no existing pipeline that resolved a lead to an exact numeric expected price (the equivalent of `interestedPackageId`/`recommendedPackageId` were dead, never-written columns) — building that pipeline was explicitly scoped out as unnecessary complexity, and the amount is instead just surfaced to the human/audit trail for visibility. **For ecommerce, you likely DO have an exact expected amount (the order total)** — if so, add a hard amount-match check to the threshold condition; it's strictly safer than what Mandy has today.

The threshold check itself lives in plain code, not inside the prompt — `isConfidentPaymentMatch()` is a pure function the vision call's *structured output* is checked against. **The LLM's job is only to describe what it sees; a fixed, auditable, non-AI condition decides whether that description is good enough to act on.** Every auto-confirmed decision's full verdict JSON (including `reasoning`) is stored in the resulting message's `meta` column for later audit — never confirm-and-forget.

---

## 7. Scheduling/availability (optional layer — evaluate whether ecommerce needs an analog)

This section is the most domain-specific of the whole system (Google Calendar integration for booking a physical shoot), included because the *pattern* — "give the AI grounded, live, real-world facts instead of letting it guess" — generalizes even if the specific API doesn't. Skip entirely if ecommerce has no scheduling concept (most doesn't, except maybe delivery-slot booking or service appointments).

Three layers, in `reference/lib/google-calendar/`:

1. **`oauth.ts`** — self-service OAuth connect flow (tenant clicks "Connect Google Calendar" in Settings, signs into their own Google account, done — no manual per-tenant setup on your side, unlike e.g. WhatsApp Business API verification which needs Meta's manual approval).
2. **`availability.ts`** — turns Google's freebusy API response plus the tenant's own booked-leads table into a **grounded fact** the prompt can state plainly: which exact time slots are open, given a configured session duration and working hours. Read the full file for the slot-math (`computeOpenSlots`) — it's a pure function, no I/O, fully unit-testable, and was verified against the real connected calendar before shipping.
3. **`sync.ts` / `events.ts`** — the deterministic side-effect layer: the moment a lead enters (or already sits in) a "Booked" money-state and has a real date/time, a real calendar event gets created/updated/deleted, automatically, best-effort (never blocks the lead's own status update on a Google API hiccup).

**The recurring lesson across every Google Calendar integration point**: Google's API rejects timestamps without an explicit UTC offset (RFC3339 requirement) — this caused a real, deployed bug (every availability check silently failed with a 400) before being caught and fixed. If you build any timestamp-sending integration, always include an explicit offset (`+08:00` or whatever your business timezone is), verified against the real API, not just a mocked response.

---

## 8. Settings/configuration UI pattern

One consistent shape used for every tenant-configurable behavior added this session (`src/app/api/settings/route.ts` + `src/app/(app)/settings/page.tsx`):

- **GET** returns the parsed brains plus a flat list of scalar settings (never returns secrets like OAuth refresh tokens — only connection *status* booleans/display strings).
- **PUT** takes a Zod-validated partial body; every field is `if (body.data.X !== undefined) data.X = ...` — i.e. **fields not sent are left untouched**, not reset to a default. This matters because the settings page saves the *entire* form on every "Save" click; if PUT treated `undefined` as "clear this field", any settings card not currently rendered/loaded would silently wipe unrelated data.
- The UI is one page with independent "cards" per concern (brand identity, sales rules, payment methods, WhatsApp connection status, Calendar connection status, booking capacity, risky feature toggles). Each card is visually and functionally independent — you can add a new one without touching any other card's code.
- **Risky/consequential toggles get their own visually distinct card** (amber/warning styling, explicit risk language in the description, default OFF) — see the `autoConfirmPayments` card as the template for "opt-in automation that could go wrong."

---

## 9. Two AI-assisted setup features (pattern only — likely lower priority for an ecommerce MVP)

Briefly, for completeness — not copied into `reference/` since they're the most wedding-specific and lowest-priority to port:

- **AI-led onboarding interview** (`src/lib/onboarding/interview.ts`): a conversational interview that fills in the four brains for a new tenant, instead of making them fill out a long form cold. Same JSON-output-contract pattern as the main sales engine, just with a different system prompt and a `readyToWrapUp` flag instead of a sales pipeline status.
- **Training role-plays** (`src/lib/training/scenarios.ts`, `synthesize.ts`): the tenant role-plays as N different customer archetypes against the bot, and their actual reply style gets synthesized (via another LLM call) into a `styleProfile` string that's injected into future prompts — a lightweight way to make the bot sound like *this specific business owner* without fine-tuning a model.

Both are optional polish, not core to the pipeline itself — build the core engine + one channel + settings first, then consider these once real usage validates the domain-specific configuration needs.

---

## 10. File-by-file map (what's in `reference/`, and what to do with each)

| Path | Reusable as-is? | Notes |
|---|---|---|
| `lib/auth.ts`, `lib/tenant.ts`, `lib/prisma.ts`, `lib/api.ts`, `lib/json.ts`, `lib/http.ts`, `lib/channels.ts` | **Yes, verbatim** | Pure infrastructure, zero domain content. |
| `lib/attachments.ts`, `lib/inbound-attachments.ts` | **Yes, verbatim** | Rename `PackageAttachment`/`fileType` enum values if your catalog concept differs, but the BLOB-safety pattern (§2) doesn't change. |
| `lib/ai/llm.ts` | **Yes, verbatim** | Provider-agnostic Claude/OpenAI wrapper + the JSON-extraction helper. |
| `lib/ai/vision.ts` | **Yes, adapt the prompt text only** | The isolation pattern and threshold-check pattern (§6) transfer directly; only the verification questions asked of the image change. |
| `lib/ai/engine.ts` | **Pattern yes, fields no** | Rewrite `extracted`/status fields for your domain; keep the retry-on-bad-JSON, confidence/takeover, and guardrail structure exactly. |
| `lib/ai/prompts.ts` | **Pattern yes, content no** | Full rewrite of section content; keep the "only emit a line if non-empty" `line()` helper and the overall section order (identity → sales playbook → known facts → language → guardrails → output contract). |
| `lib/ai/schemas.ts` | **Shape yes, fields no** | Rewrite the four brain schemas' fields per §2's suggested ecommerce mapping. |
| `lib/whatsapp/*`, `lib/webhooks/inbound.ts` | **Yes, verbatim** | Fully channel/domain-agnostic. |
| `lib/leads/confirm-deposit.ts` | **Pattern yes, rename** | This is the money-state single-choke-point (§4) — rename to your domain's equivalent (e.g. `confirm-order-payment.ts`) but keep the "one function, called from exactly the human PATCH route and the one AI-vision path" invariant. |
| `lib/google-calendar/*` | **Optional** | Only port if ecommerce needs scheduling (delivery slots, service appointments). Otherwise skip entirely — see §7. |
| `lib/i18n/*` | **Mechanism yes, dictionary content no** | `en.example.ts` shows the key-naming convention; write fresh dictionaries for your domain's copy. |
| `components/Chat.tsx`, `Icons.tsx`, `StatusBadge.tsx`, `ChannelBadge.tsx`, `LanguageSwitcher.tsx` | **Yes, verbatim** | Generic chat UI; `StatusBadge`/`ChannelBadge` just need your domain's status enum passed in. |
| `api-routes/*` | **Pattern yes** | Flattened copies (folder nesting removed since these aren't in a live Next.js app here) — restore proper `[id]/route.ts` nesting when you scaffold the new project. |
| `schema.prisma.example`, `package.json.example` | **Reference only** | Shows the full dependency list and the complete data model this session arrived at — use as a checklist, not a copy-paste target (models need renaming: `Lead`→`Order`/`Ticket`, `Package`→`Product`, etc.) |
| `settings-page.tsx.example`, `playground-page.tsx.example`, `login-page.tsx.example`, `auth-layout.tsx.example`, `not-found.tsx.example` | **Reference only** | Real, working UI for the patterns above — read for structure, rewrite copy/labels. |

---

## 11. Other lessons worth carrying over (short version)

- **Process-isolate risky parsing.** PDF text extraction (in onboarding document upload) was moved into a spawned child process with a hard timeout, because a pathological PDF could otherwise OOM-crash or hang the whole server on a single request. Any "parse an arbitrary user-uploaded file" feature should consider this.
- **Message ordering**: same-millisecond database writes (a customer message and the bot's reply, written in one transaction) need a secondary sort key (`id`, since cuids are creation-ordered) — `createdAt` alone is not a reliable tie-breaker.
- **Inject "today's date" into the prompt.** The model has no innate sense of "now" — without explicitly stating today's date (in the tenant's timezone) in the system prompt, relative-date phrases ("next March") get resolved against the model's training cutoff, not reality.
- **A 429/format rejection isn't always a real error** — e.g. newer Claude models reject the deprecated `temperature` parameter for some call shapes; check the actual API error text before assuming a whole feature is broken.
- **Verify against real data, not mocks, whenever the "real" system is cheap to query.** Every feature in this session that touched the live Google Calendar or the live database was verified with an actual API call / actual DB read-back before being called done — mocked tests catch logic bugs, but only real calls catch format/auth/actual-behavior bugs (the RFC3339 offset bug was invisible to a mocked test and only surfaced against the real API).
