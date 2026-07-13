import { z } from "zod";

// ---------- Brain shapes (stored as JSON strings on StoreProfile) ----------

export const IdentityBrainSchema = z
  .object({
    agentName: z.string().default(""),
    storeName: z.string().default(""),
    location: z.string().default(""),
    category: z.string().default("Wellness & beauty (MAE Global)"),
    targetCustomer: z.string().default(""),
    brandPersonality: z.string().default(""),
    values: z.string().default(""),
    toneOfVoice: z.string().default(""),
    languageStyle: z.string().default(""),
    differentiators: z.string().default(""),
    offerings: z.string().default(""),
  })
  .partial()
  .default({});
export type IdentityBrain = z.infer<typeof IdentityBrainSchema>;

export const SalesBrainSchema = z
  .object({
    discountRules: z.string().default(""),
    followUpRules: z.string().default(""),
    allowedToSay: z.string().default(""),
    neverSay: z.string().default(""),
    salesPressure: z.string().default("balanced"), // soft | balanced | assertive
    objectionStyle: z.string().default(""),
    styleProfile: z.string().default(""), // synthesized from training examples
    // Business-specific notes layered on top of the baked-in discovery-first
    // and upsell playbooks in prompts.ts.
    conversationStrategy: z.string().default(""),
    upsellStrategy: z.string().default(""),
    // The agent's personal working preferences — defaults GC leans on, not
    // hard rules.
    agentPreferences: z.string().default(""),
  })
  .partial()
  .default({});
export type SalesBrain = z.infer<typeof SalesBrainSchema>;

export const FulfillmentBrainSchema = z
  .object({
    paymentMethods: z.string().default(""), // bank/DuitNow/TNG details for proof-matching
    paymentInstructions: z.string().default(""),
    codRules: z.string().default(""), // cash-on-delivery, if offered
    shippingPolicy: z.string().default(""),
    shippingFeeRules: z.string().default(""),
    deliveryTimeline: z.string().default(""),
    returnRefundPolicy: z.string().default(""),
    orderVerificationRules: z.string().default(""), // what counts as valid proof of payment
    humanOnlyTopics: z.string().default(""),
  })
  .partial()
  .default({});
export type FulfillmentBrain = z.infer<typeof FulfillmentBrainSchema>;

export const CatalogRulesSchema = z
  .object({
    // Update this ONE field each month with the current specials/promos — GC
    // surfaces it prominently instead of you editing every product row.
    currentPromotions: z.string().default(""),
    bundleRules: z.string().default(""), // BxFy conventions, PWP campaigns
    membershipPitch: z.string().default(""), // member vs retail price story
    loyaltyProgram: z.string().default(""), // XP / M-COIN talking points
    authenticityGuarantee: z.string().default(""), // vs grey-market resellers
    complianceRules: z.string().default(""), // health-claim language boundaries
  })
  .partial()
  .default({});
export type CatalogRules = z.infer<typeof CatalogRulesSchema>;

// ---------- AI engine output contract ----------

// The model may propose an order cart; code independently resolves each
// productId against the tenant's active catalog, recomputes every price, and
// only then writes items/total. The model's own price math is never trusted.
export const ProposedOrderSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string(),
          qty: z.number().int().min(1).max(99).catch(1),
        })
      )
      .default([]),
  })
  .nullish();

export const EngineOutputSchema = z.object({
  reply: z.string(),
  detectedLanguage: z.enum(["en", "zh", "ms", "mixed"]).catch("en"),
  extracted: z
    .object({
      customerName: z.string().nullish(),
      phone: z.string().nullish(),
      deliveryAddress: z.string().nullish(),
      segment: z.string().nullish(), // e.g. "working mum", "3-high patient", "postpartum"
      productInterest: z.string().nullish(),
      market: z.enum(["MY", "SG", "BN"]).nullish(), // customer's country when revealed
    })
    .catch({}),
  // Set only when the customer has clearly agreed to buy specific items.
  proposedOrder: ProposedOrderSchema,
  suggestedStatus: z.string().nullish(),
  takeover: z
    .object({
      needed: z.boolean().catch(false),
      reason: z.string().nullish(),
    })
    .catch({ needed: false, reason: null }),
  confidence: z.number().min(0).max(1).catch(0.8),
  // Attachment ids (from the product catalog) GC wants to send with this
  // reply. Validated server-side against real, tenant-owned attachments.
  sendAttachmentIds: z.array(z.string()).catch([]).default([]),
});
export type EngineOutput = z.infer<typeof EngineOutputSchema>;

// ---------- AI-led setup interview output contract ----------

export const InterviewOutputSchema = z.object({
  reply: z.string(),
  extracted: z
    .object({
      identityBrain: IdentityBrainSchema.optional(),
      salesBrain: SalesBrainSchema.optional(),
      fulfillmentBrain: FulfillmentBrainSchema.optional(),
      catalogRules: CatalogRulesSchema.optional(),
    })
    .catch({}),
  readyToWrapUp: z.boolean().catch(false),
});
export type InterviewOutput = z.infer<typeof InterviewOutputSchema>;
