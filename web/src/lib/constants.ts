// Canonical values for the enum-like string fields in prisma/schema.prisma.

export const ORDER_SOURCES = ["PLAYGROUND", "WHATSAPP", "MESSENGER", "INSTAGRAM"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

// The sales pipeline. GC (the AI) may move an order freely between the
// AI_ALLOWED_STATUSES; MONEY_STATES can only ever be entered through
// src/lib/orders/confirm-payment.ts (the single money choke point) or the
// agent's own manual edit.
export const ORDER_STATUSES = [
  "New Inquiry",
  "Qualifying",
  "Recommended",
  "Closing",
  "Awaiting Payment",
  "Payment Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
  "Lost",
  "Human Takeover Needed",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Statuses the AI is allowed to *suggest* its way into. Money/fulfillment
// states are deliberately absent — see applyEngineEffects.
export const AI_ALLOWED_STATUSES: OrderStatus[] = [
  "New Inquiry",
  "Qualifying",
  "Recommended",
  "Closing",
  "Awaiting Payment",
  "Lost",
];

// Once an order is in one of these, no AI code path may change its status.
export const MONEY_STATES: OrderStatus[] = ["Payment Confirmed", "Processing", "Shipped", "Delivered"];

export const PAYMENT_STATUSES = [
  "NONE",
  "INSTRUCTIONS_SENT",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CHANNELS = ["WHATSAPP", "MESSENGER", "INSTAGRAM"] as const;
export type Channel = (typeof CHANNELS)[number];

// ---------- Markets (MY & Brunei share the MYR store; SG is a separate SGD entity) ----------
export const MARKETS = ["MY", "SG", "BN"] as const;
export type Market = (typeof MARKETS)[number];

export const MARKET_INFO: Record<
  Market,
  {
    name: string;
    currency: string;
    currencySymbol: string;
    store: string;
    shipping: string;
    languages: string;
    localVoice: string;
    // Payment rails buyers in this market actually expect to be offered.
    paymentRails: string;
    // How sellers here actually address a customer they don't know yet.
    addressTerms: string;
    // Market-specific selling and compliance switches (see
    // research/SEA_CHAT_COMMERCE.md). These are legal/consumer-protection
    // facts, not style preferences.
    compliance: string;
  }
> = {
  MY: {
    name: "Malaysia",
    currency: "MYR",
    currencySymbol: "RM",
    store: "MAE Global Malaysia (maeglobalofficial.com, MYR)",
    shipping:
      "FREE delivery nationwide (no minimum); processed in 1-3 working days, delivered ~5-7 business days; self-pickup at Puchong HQ / Miri / Penang. Free shipping is also a MAE Club member perk.",
    languages: "English (Manglish), Mandarin, Bahasa Malaysia, or rojak mix",
    paymentRails: "DuitNow QR / DuitNow transfer, FPX online banking, Touch 'n Go eWallet, and COD where the agent offers it. Atome instalments suit the bigger programmes (and Atome is marketed as Shariah-compliant, which matters to many Malaysian buyers).",
    addressTerms:
      "English/Manglish: \"dear\" is the everyday Malaysian seller default and is safe for anyone; \"sis\" or \"bro\" once the chat is genuinely warm; \"boss\" plays well with men. " +
      "Malay: \"kak\" for a woman and \"abang\"/\"bang\" for a man are warm and respectful; \"dik\" for someone clearly younger; \"puan\"/\"encik\"/\"cik\" when they write formally. " +
      "Mandarin: \"亲\" is the standard Chinese-ecommerce address and is safe for anyone; \"美女\" is very common and lands as friendly (not flirty) with a female customer in a beauty or wellness chat; \"姐\" for someone older or more senior. Never \"亲爱的\" — too intimate from a seller.",
    compliance:
      "PRICE MUST BE GIVEN ON FIRST ASK. Malaysian e-commerce regulations require a seller to display the full price including taxes and delivery, plus business name and registration number. 'PM for price' is the exact practice the ministry declared illegal (penalties up to RM50,000 and/or 3 years). Halal: name the certifying body if certified, and NEVER imply certification that doesn't exist — marketing something as halal without valid certification is itself the offence. Cite the NPRA MAL registration number when asked about safety, but never claim registration means the product works. Buyers here routinely check a seller's bank account against the police mule-account database before paying, so a bare account number reads as a scam.",
    localVoice:
      "Sound like a warm Malaysian seller. English = Manglish: natural 'lah', 'lor', 'can', 'boleh', 'ya', 'har', 'wan', rojak-mixing English with a little Malay/Chinese is very natural here. Mandarin = Malaysian-Chinese style (simplified characters, casual, mixes in some English words like 'ok'/'try'/'promo'). Malay = warm everyday Bahasa Malaysia. Rojak (mixing all three in one message) is completely normal and endearing — mirror whatever mix they use.",
  },
  BN: {
    name: "Brunei",
    currency: "MYR", // served from the MY store; quote MYR unless the agent configures BND
    currencySymbol: "RM",
    store: "MAE Global (served from the Malaysia & Brunei store, MYR)",
    shipping:
      "Served from the Malaysia & Brunei store. Cross-border delivery to Brunei — confirm the delivery method, fee and timing (and whether COD is available) with the agent; don't promise free local delivery.",
    languages: "Malay (dominant), English, some Mandarin",
    paymentRails: "Confirm with the agent — cross-border from the Malaysia store. Do not promise a rail you haven't confirmed.",
    addressTerms:
      "Lean formal and respectful, more than Malaysia. Malay: \"kak\", \"abang\", and \"puan\"/\"encik\" are the safe choices. " +
      "English: \"dear\" is fine; avoid \"sis\"/\"bro\" until they use that register first. Mandarin: \"亲\".",
    compliance:
      "Halal is a GATE here, not a bonus: treat proof of halal status as a precondition, not a selling point to mention later. Malay-dominant and more formal than Malaysia. Keep imagery conservative. Health products crossing the border sit under Ministry of Health import rules, so never promise customs-free or same-day delivery.",
    localVoice:
      "Sound like a polite, warm Bruneian seller. Malay is the default and most natural here — use gentle, respectful Bruneian/standard Malay (a soft 'bah' is locally natural). Keep English polite and warm if they use it. Mandarin only if they write in Chinese. Bruneians tend to be a touch more formal and courteous than Malaysians — lean warm and respectful, lighter on slang.",
  },
  SG: {
    name: "Singapore",
    currency: "SGD",
    currencySymbol: "S$",
    store: "MAE Global (SG) Pte Ltd — separate Singapore entity, SGD pricing, ships within Singapore",
    shipping:
      "Local Singapore delivery; free shipping is a MAE Club member perk (MY/SG/HK). If SGD prices aren't configured for a product, confirm the exact SGD price with the agent rather than quoting the Malaysian RM price.",
    languages: "English (Singlish), Mandarin",
    localVoice:
      "Sound like a friendly Singaporean seller. English = Singlish flavour where it fits: 'lah', 'leh', 'lor', 'sia', 'can can', 'okay lah', 'quite good sia' — natural but not overdone. Mandarin = Singaporean-Chinese style (simplified, crisp, mixes in English words). Malay is uncommon for this customer base — don't default to it. Singaporeans are a bit more fast-paced and value-conscious; be efficient and warm.",
    paymentRails: "PayNow is what Singapore buyers expect. Offer it by name rather than saying 'bank transfer'.",
    addressTerms:
      "The most restrained of the markets. Use their NAME if you have it, otherwise no address term at all is perfectly normal here. " +
      "\"Dear\" occasionally is acceptable; \"sis\"/\"babe\" reads as pushy to a Singaporean buyer and should be avoided unless they use it first. Mandarin: \"亲\" is fine.",
    compliance:
      "STRICTEST claim rules of all the markets. HSA does not pre-approve health supplements, so 'HSA-approved' or 'HSA-registered' is itself a false claim — never say it. HSA also names '100% safe', 'clinically proven' and fast-result promises as misleading. Before/after testimonials that reference a condition are treated as prohibited disease-treatment claims. Keep the register restrained: no 'sis'/'dear', no stacked urgency, lighter on emoji than Malaysia.",
  },
};

export function marketCurrency(market: Market | string | null | undefined): { code: string; symbol: string } {
  const m = (market && MARKETS.includes(market as Market) ? (market as Market) : "MY") as Market;
  return { code: MARKET_INFO[m].currency, symbol: MARKET_INFO[m].currencySymbol };
}

export const USER_ROLES = ["ADMIN", "AGENT"] as const;
export type UserRole = (typeof USER_ROLES)[number];
