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
  },
};

export function marketCurrency(market: Market | string | null | undefined): { code: string; symbol: string } {
  const m = (market && MARKETS.includes(market as Market) ? (market as Market) : "MY") as Market;
  return { code: MARKET_INFO[m].currency, symbol: MARKET_INFO[m].currencySymbol };
}

export const USER_ROLES = ["ADMIN", "AGENT"] as const;
export type UserRole = (typeof USER_ROLES)[number];
