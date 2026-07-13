# Ecommerce-specific starting point

Concrete suggestions for adapting the patterns in `ARCHITECTURE.md` to an ecommerce customer-service/sales bot. This is a starting proposal, not a spec — adjust once you know the actual store's needs.

## Suggested brain schemas (replaces `src/lib/ai/schemas.ts`)

```ts
export const IdentityBrainSchema = z.object({
  storeName: z.string().default(""),
  category: z.string().default(""),          // "fashion", "electronics", "F&B", ...
  targetCustomer: z.string().default(""),
  brandPersonality: z.string().default(""),
  toneOfVoice: z.string().default(""),
  languageStyle: z.string().default(""),
  differentiators: z.string().default(""),
}).partial().default({});

export const SalesSupportBrainSchema = z.object({
  discountRules: z.string().default(""),
  returnEligibilityRules: z.string().default(""),   // "within 7 days, unworn, with tags"
  escalationStyle: z.string().default(""),
  upsellRules: z.string().default(""),
  allowedToSay: z.string().default(""),
  neverSay: z.string().default(""),
  styleProfile: z.string().default(""),             // learned from training role-plays, same as Mandy
}).partial().default({});

export const FulfillmentBrainSchema = z.object({
  paymentMethods: z.string().default(""),           // bank/DuitNow/e-wallet details for proof-matching
  paymentInstructions: z.string().default(""),
  shippingPolicy: z.string().default(""),
  shippingFeeRules: z.string().default(""),
  returnRefundPolicy: z.string().default(""),
  orderVerificationRules: z.string().default(""),   // what counts as valid proof of payment/COD
  humanOnlyTopics: z.string().default(""),           // e.g. "disputes over RM500", "legal threats"
}).partial().default({});

export const CatalogRulesSchema = z.object({
  bulkDiscountRules: z.string().default(""),
  shippingZoneRules: z.string().default(""),
}).partial().default({});
```

## Suggested model renames (from `schema.prisma.example`)

| Mandy | Ecommerce equivalent | Notes |
|---|---|---|
| `PhotographerProfile` | `StoreProfile` | Same shape: one row per tenant, `userId`, four brain JSON columns. |
| `Package` | `Product` | `priceMyr`→keep, `hours`/`includesAlbum`/`includesVideo` are wedding-specific — replace with `sku`, `stockQty`, `variants` (JSON), `category`. |
| `PackageAttachment` | `ProductImage` | Same BLOB discipline. |
| `Lead` | `Order` (or `Conversation`+`Order` split if you want pre-purchase chat separate from post-purchase order tracking) | `eventDate`/`eventTime`/`eventType`/`location` → `orderNumber`, `productSku`, `deliveryAddress`, `desiredDeliveryDate` (if relevant). `budgetRange` → keep, or drop if not doing pre-purchase qualification. |
| `depositStatus` (`NONE`/`INSTRUCTIONS_SENT`/`PENDING_CONFIRMATION`/`CONFIRMED`) | `paymentStatus` | Same states, same money-state-protection pattern (§4 of ARCHITECTURE.md). |
| `calendarStatus`/`googleEventId` | Drop, or repurpose as `deliveryScheduled`/`deliverySlotId` if you integrate a delivery-scheduling calendar. |
| `LEAD_STATUSES` pipeline (`New Lead → Asking Price → Qualifying → Qualified → Package Recommended → Waiting Decision → Waiting Deposit → Deposit Paid → Booked → Lost → Human Takeover Needed`) | `ORDER_STATUSES`, e.g. `New Inquiry → Browsing → Cart → Awaiting Payment → Payment Confirmed → Processing → Shipped → Delivered → Returned → Human Takeover Needed` | Keep exactly two things: (1) a fixed enum-like whitelist the AI can freely move between, (2) 1-2 "money states" that only the single choke-point function (§4) can set. |

## Suggested extraction contract (`extracted` in the output schema)

```ts
extracted: {
  customerName: string | null,
  orderNumber: string | null,       // if they're asking about an existing order
  productSku: string | null,        // if browsing/asking about a specific product
  issueType: string | null,         // "wrong item", "damaged", "late delivery", "want refund"
  desiredResolution: string | null, // "refund", "replacement", "just checking status"
}
```

## What's very likely to be needed on day one (unlike Mandy, where these were incremental)

1. **Order-status lookup**: the AI needs read access to real order/shipping status (a "grounded fact" injection, same pattern as Mandy's calendar-availability injection in `engine.ts` — fetch it before building the prompt, inject as a plain factual line, never let the model guess).
2. **Proof-of-payment handling from day one** (§6 of ARCHITECTURE.md) — this is probably the single most valuable piece to port verbatim, since COD/bank-transfer proof screenshots are extremely common in Malaysia-style ecommerce checkout flows, and the existing pattern (deterministic handling, optional AI-vision auto-confirm with a real amount-match check since order totals ARE known exactly here) is a strict improvement over what Mandy has.
3. **Product catalog Q&A** — the `renderPackage()`-equivalent function in `prompts.ts` that turns catalog rows into prompt text; for ecommerce this probably needs pagination/filtering logic Mandy never needed (a wedding studio has ~5 packages; a store might have 500 SKUs — don't dump the whole catalog into every prompt, fetch only what's relevant to the current conversation, e.g. via a simple keyword match or a "currently viewing product" field on the order/conversation).
