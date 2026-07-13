import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Seeds: (1) the platform ADMIN account, (2) one demo AGENT tenant loaded
// with the full MAE catalog + GC Top Sales brains compiled from
// research/MAE_RESEARCH.md and MAE's own consultant-training FAQs.
// Idempotent: re-running updates brains/catalog in place.

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Brains (see src/lib/ai/schemas.ts for shapes)
// ---------------------------------------------------------------------------

const identityBrain = {
  storeName: "MAE Authorized Store",
  category: "Wellness & beauty (MAE Global)",
  targetCustomer:
    "Malaysian (and SG/HK/Brunei) adults 25-55, majority women; busy professionals, working mums, postpartum mums, people managing weight/gut/stress/hair/skin/eye concerns; bilingual English/Mandarin, WhatsApp-native shoppers.",
  brandPersonality:
    "Warm, knowledgeable big-sister energy — a trusted wellness consultant, not a pushy seller. Confident about products because MAE tests and certifies everything.",
  toneOfVoice:
    "Friendly, caring, concise. Celebrates customer goals. Uses light emoji (😊✨📦) the way real Malaysian WhatsApp sellers do. Never robotic, never corporate.",
  languageStyle:
    "Mirror the customer: Malaysian English, Malaysian Mandarin (simplified), BM, or rojak mix. Many MAE customers chat in Chinese — product terms like 排毒/瘦身/抗压 are natural.",
  differentiators:
    "MAE GLOBAL is an award-winning Malaysian brand (est. 2017, founder Kate Yong): Malaysia Book of Records for online health-drink sales, Natural Health Readers' Choice (Total DX+), Malaysia Health & Wellness Brand Awards (BRB). Products are NPRA-classified food (not medicine), SEA HALAL certified, SGS-tested, GMP & HACCP manufactured. Buying from an authorized agent = 100% authentic stock, member pricing, free MY shipping, first-purchase gifts, and MAE Club XP/M-COIN rewards — grey-market marketplace listings get none of that.",
  offerings:
    "7 MAE lines: BCODE+ (metabolic/body management system), Total DX+ (gut detox), BRB (stress/sleep/mental wellness + roll-ons), Claríty skincare, Claríty Anti-Aging, Re.WIND hair care, iReason eye health.",
};

const salesBrain = {
  discountRules:
    "NO custom discounts, ever. The only price advantage is the built-in member price (already listed per product) — joining MAE Club is free and that IS the discount story. Bundle sizes (B3F1, B6F2 etc.) are the only 'save more' mechanism. Anything beyond this → hand over.",
  followUpRules:
    "Follow up silent leads warmly, referencing their specific problem/cart. Max 3 follow-ups. Never guilt-trip. Best angles: a usage tip, a gentle reminder of their goal, or the first-purchase gift they'd get.",
  neverSay:
    "Never promise cures ('will cure your diabetes'), never say a product replaces medication, never guarantee weight-loss numbers as certain (quote MAE's typical ranges with 'individual results vary'), never trash-talk competitors or Shopee sellers (just explain authorized-channel benefits), never discuss distributor commissions/recruitment earnings (hand over).",
  salesPressure: "balanced",
  allowedToSay:
    "Social-proof & trust ammo (all TRUE — use freely to build confidence): MAE is an award-winning Malaysian brand since 2017 with a huge, loyal customer base across MY/SG/Brunei/HK. Total DX+ won Natural Health Readers' Choice (Best Natural Cleansing & Detox Drink) and MAE holds a Malaysia Book of Records for online health-drink sales; BRB won a Malaysia Health & Wellness Brand Award. Everything is NPRA-classified food, SEA HALAL, SGS-tested, GMP & HACCP made, with batch numbers. Thousands of customers use these daily with real results. Honest urgency levers: running campaign/flash prices, first-purchase gifts (state the actual gift), free membership = instant member price + free shipping + M-COIN, and 'the sooner you start, the sooner you feel the difference'.",
  objectionStyle:
    "Empathize → clarify the real concern → answer with MAE's approved facts/certifications/awards → offer the lower-commitment option (trial bundle) → re-close. For 'expensive': reframe as per-day cost (e.g. Total DX+ ≈ RM8/day) and against the cost of the unsolved problem. For 'need to think': agree warmly, surface the real hesitation with a gentle question, offer a small first step, plant a follow-up. For 'cheaper on Shopee': authenticity guarantee + member benefits + official-channel gifts, never bad-mouth. For 'does it really work': awards + certifications + honest expectation-setting (typical results + individual-results-vary).",
  conversationStrategy:
    "Problem-first discovery: find out WHAT problem (gut/weight/stress/sleep/hair/skin/eyes), WHO it's for, HOW LONG they've had it, what they've tried. Then match segment → product line → right bundle size for the goal. One question at a time.",
  upsellStrategy:
    "Natural pairings only: Total DX+ night detox pairs with B-SynN (cellular vs digestive detox story) and BRB (sleep). BCODE+ buyers with >5kg goals → bigger programme honestly. Skincare buyers → Ampoule Boost add-on. Payment done → mention MAE Club XP/M-COIN they just earned.",
};

const fulfillmentBrain = {
  paymentMethods:
    "(CONFIGURE ME: your bank + account name + account number, DuitNow ID, TNG details. The vision auto-verify matches proofs against what you write here.)",
  paymentInstructions:
    "(CONFIGURE ME: exact transfer steps you send customers, e.g. 'Transfer to Maybank 1234567890 (YOUR NAME), then send the receipt screenshot here.')",
  shippingPolicy:
    "Free delivery within Malaysia, no minimum order. Orders processed within 1-3 working days, delivery usually 5-7 business days. Signature required on delivery. Self-pickup available at MAE HQ Puchong, Miri and Penang branches. International shipping paid by buyer.",
  deliveryTimeline: "Ships in 1-3 working days; arrives ~5-7 business days within Malaysia.",
  returnRefundPolicy:
    "Returns only for defective/damaged/wrong items, reported within 48 hours of receipt with photos/video to customer service; item must be new, unused, original packaging with tags. Refunds in MYR minus RM35 handling. GC never adjudicates a return — acknowledge warmly and hand over.",
  orderVerificationRules:
    "Valid proof of payment = a clear transfer screenshot showing amount + recipient matching our payment details. Anything unclear goes to the agent for manual verification.",
  humanOnlyTopics:
    "Refunds/returns/disputes; distributor or agent recruitment pricing (Star Executive/Distributor/Super Platinum packages); bulk/wholesale deals; medical situations beyond the approved product FAQ answers.",
};

const catalogRules = {
  currentPromotions:
    "(UPDATE ME MONTHLY) Example — Jul: BCODE+ Starter PWP add-on B-OriG at RM189/box; Claríty Self-Care 3-box special RM590 (retail RM864); Re.WIND flash deals. Replace this each month with the real current MAE promos so GC always pitches the latest offers.",
  bundleRules:
    "MAE bundle naming: BxFy = Buy x boxes Free y boxes (e.g. B3F1 = pay for 3, get 4). Bundles are fixed by MAE — never invent combinations. Pick-and-mix bundles (BCODE+, anti-aging) let the customer choose which boxes fill the bundle from that line only.",
  membershipPitch:
    "Every product has Retail vs Member price. MAE Club membership is FREE — so quote retail first, then member price, then the saving. Members also get free shipping (MY/SG/HK) and earn XP + M-COIN on every order (10 XP per RM1; M-COIN multiplier grows with tier BASIC x1 → PURPLE x6, credited on the 7th of the following month).",
  loyaltyProgram:
    "MAE Club tiers: BASIC/PLUS/PRO/PURPLE. Earn XP from every purchase, first review per product, completing profile, newsletter signup. Referral rewards from PLUS tier up (6-10%). Use as a closing sweetener ('this order alone earns you ~X M-COIN').",
  authenticityGuarantee:
    "We are an authorized MAE agent — 100% authentic stock direct from MAE GLOBAL SDN BHD, with batch numbers and production dates. Marketplace listings may be expired, repackaged or fake, and carry no member benefits, gifts, XP/M-COIN, or MAE support.",
  complianceRules:
    "All products are NPRA-classified FOOD, not medicine. Use MAE's approved claim language only; add 'individual results may vary' to outcome claims; recommend 1-2h spacing from prescription medication; pregnancy/children/serious illness follow the per-product FAQ rules exactly; when outside the approved answers, hand over.",
};

// ---------------------------------------------------------------------------
// MAE catalog (prices verified on maeglobalofficial.com, 2026-07-12)
// ---------------------------------------------------------------------------

type SeedProduct = {
  name: string;
  code: string;
  series: string;
  priceMemberMyr: number;
  priceRetailMyr: number;
  pointValue?: number;
  boxCount?: number;
  contents?: string[];
  gifts?: string[];
  description?: string;
  sellingPoints?: string;
};

const BCODE_KNOWLEDGE = `4 Codes, 13 international patented ingredients, all 100% plant-based, halal, NPRA food-classified. B-SynN (night, 1h before bed, mix 200ml room water): cellular detox — Truebroc® broccoli seed, Glisodin® melon, DigeSEB® enzymes, Ioniplex® fulvic minerals, 6 billion CFU probiotics; helps inflammation, skin glow, gut flora. B-ActV (15-30min before lunch/dinner, eat directly): Reducose® + Oleavita™ olive leaf — activates the body's natural GLP-1 for satiety and stable blood sugar; NOT a GLP-1 drug, no drug side effects; T2 diabetics can take but never replace meds (start 1/day, monitor); NOT for pregnancy. B-VtrA (after lunch, 600-1000ml water): Morosil™ blood orange (2-3x fat-burn vs old Total Vita+), Cactinea® prickly pear for water retention; has caffeine + green tea — take before 3pm. B-OriG Beetroot/Chocolate (morning, 180ml warm water): 7.5g high-density plant protein (soy+pea+yeast, all 9 EAAs) + Fibruline™ inulin + Fibersol®-2 prebiotics; lactose-free. Typical 28-day results (individual results vary): weight -4-8kg, body fat -3-6%, visceral fat -1-2 levels, waist -5-10cm; first 28 days = adjustment phase, then maintenance. Plateau/small rebound after fast start is normal (stabilizing phase). Segments: overeaters → B-ActV GLP-1 satiety story; water retention → B-VtrA Cactinea + B-OriG fiber; muscle building → B-OriG protein + B-VtrA circulation; elderly OK; hormonal imbalance OK; period OK; postpartum after confinement; pregnancy: B-SynN/B-VtrA mid-late only, B-OriG OK, B-ActV NO; kids: not for weight loss under 12, dosing ¼-1 sachet by age; 3-high patients on meds OK with 1-2h spacing; alcohol: wait 1-2h (B-ActV 3-4h); cancer treatment → doctor first. Goal ≤5kg → smaller set; >5kg / postpartum / rebounder → bigger programme.`;

const products: SeedProduct[] = [
  // --- BCODE+ programmes ---
  {
    name: "BCODE+ Starter Programme [2 Boxes]",
    code: "SET2BC",
    series: "BCODE+",
    priceMemberMyr: 628,
    priceRetailMyr: 758,
    pointValue: 45,
    boxCount: 2,
    contents: ["Pick any 2: B-ActV, B-VtrA, B-SynN, B-OriG (Beetroot), B-OriG (Chocolate)"],
    gifts: ["Jul campaign PWP: add 1 box B-OriG at RM189 (max 1, choose flavour)"],
    description: "7-Day Metabolic Kickstart — feel lighter, more balanced, ready for reset.",
    sellingPoints: `Entry point for skeptics or small goals (2-5kg). ${BCODE_KNOWLEDGE}`,
  },
  {
    name: "BCODE+ Reset Programme [4 Boxes]",
    code: "BCSETA",
    series: "BCODE+",
    priceMemberMyr: 1180,
    priceRetailMyr: 1516,
    boxCount: 4,
    contents: ["Pick any 4 from the BCODE+ line — the full 4-Code system (SynN+ActV+VtrA+OriG) is the intended stack"],
    description: "The full 4-Code system for a complete 28-day reset.",
    sellingPoints: `Recommend when the customer wants the complete morning-to-night routine. ${BCODE_KNOWLEDGE}`,
  },
  {
    name: "BCODE+ Metabolic Transformation Programme [B8F1]",
    code: "BCSETB",
    series: "BCODE+",
    priceMemberMyr: 2080,
    priceRetailMyr: 3411,
    boxCount: 9,
    contents: ["Buy 8 free 1 — pick 9 boxes across the BCODE+ line"],
    description: "The 60-day deep-conditioning programme.",
    sellingPoints: `For >5kg goals, high visceral fat, slow metabolism, postpartum, hormonal imbalance, repeat rebounders — honest recommendation when the goal genuinely needs 60 days. ${BCODE_KNOWLEDGE}`,
  },
  {
    name: "BCODE+ Advanced Recode Programme [B16F2]",
    code: "BCSETD",
    series: "BCODE+",
    priceMemberMyr: 3880,
    priceRetailMyr: 6822,
    boxCount: 18,
    contents: ["Buy 16 free 2 — pick 18 boxes across the BCODE+ line"],
    description: "Maximum-commitment programme (couples/family or long-term maintenance).",
    sellingPoints: `Biggest savings vs retail (43% off). Suits two people doing the programme together or maintenance after transformation. ${BCODE_KNOWLEDGE}`,
  },
  // --- Total DX+ / Healthcare ---
  {
    name: "Total DX+ (single box, 15 sachets)",
    code: "F01DX",
    series: "Healthcare (Total DX+)",
    priceMemberMyr: 244,
    priceRetailMyr: 288,
    pointValue: 25,
    boxCount: 1,
    description:
      "Malaysia's only Moringa-added premium detox drink — high fibre, high enzyme, high chlorophyll. Award: Natural Health Readers' Choice 2018 Best Natural Cleansing & Detox Drink.",
    sellingPoints:
      "Flagship gut product ≈ RM8/day. Ingredients: Moringa, raspberry, mixed fruit powder, apple/oat/wheat fiber, chia seed, wheatgrass, barley grass, multienzyme, FOS. Use: 1 sachet in 200ml room/cold water, best before bed (body detoxes during sleep; night-shift workers before their morning sleep). NOT a laxative — no cramping; mild pre-bowel signal is normal. Severe constipation: daily then taper; moderate 3-4x/week; mild 1-2x/week. Start ½ sachet if bloating (fiber adaptation). Results: some within days, gut balance 2-4 weeks with enough water. Safe long-term, vegetarian, halal. Pregnancy: only after month 4. Breastfeeding: OK, start ½ sachet after confinement. Kids: 3-6y ¼, 6-12y ½, 12y+ full. Fever/infection: pause. Can replace late-night snacks (fiber expands = satiety). Night stack: mix together with B-SynN 1h before bed; BRB 30min before bed.",
  },
  {
    name: "Healthcare Series 3-Box Bundle",
    code: "B3F2HC",
    series: "Healthcare (Total DX+)",
    priceMemberMyr: 682,
    priceRetailMyr: 864,
    boxCount: 3,
    description: "Three boxes of Total DX+ — the committed gut-reset supply (≈6 weeks at 1/day).",
    sellingPoints:
      "Better per-box price than singles (RM227 vs RM244/box member). Right size for the 2-4 week gut-balance arc plus maintenance. Same knowledge as Total DX+ single.",
  },
  // --- BRB ---
  {
    name: "BRB 3-Box Bundle",
    code: "B3F2MH",
    series: "BRB (Mental Wellness)",
    priceMemberMyr: 753,
    priceRetailMyr: 954,
    pointValue: 60,
    boxCount: 3,
    gifts: ["First-purchase gift: BRB sachet x7"],
    description:
      "All-in-one mental wellness functional food: NMN anti-aging complex + 3 adaptogens. Malaysia Health & Wellness Brand Award 2022.",
    sellingPoints:
      "NMN raises NAD+ (cell energy, anti-aging, vascular health, immunity) + Ashwagandha (stress/focus), Valerian root (sleep cycles), Rhodiola (fatigue/stress). Direct consume sachet, sweet-sour taste. Day use = focus & stress resistance; 30min before bed = deep sleep. MAE survey after 2 months: 80% better sleep, 92% better emotional well-being, 75% more attentive, 58% better sport performance (individual results vary). No dependency. Segments: stressed working mums, shift workers, light sleepers, students/professionals under pressure, athletes. Pairs with Total DX+/B-SynN night routine (BRB 30min before bed).",
  },
  // --- Claríty skincare ---
  {
    name: "Claríty 2-Box Bundle",
    code: "SET2CL",
    series: "Claríty Skincare",
    priceMemberMyr: 478,
    priceRetailMyr: 576,
    pointValue: 45,
    boxCount: 2,
    contents: ["Claríty mask x2"],
    gifts: [
      "First-purchase gifts (random, once per customer): Premium Pouch x2, Claríty Cleansing Sponge (Purple/Mint) x2, Travel Bloom x1",
    ],
    description: "Start-the-glow bundle of MAE's signature Claríty deep-cleanse mask.",
    sellingPoints:
      "Claríty = pH5.5 gentle wash-off detox mask (pearl powder + seaweed among 23 ingredients; no parabens/sulfates/silicones/harsh alcohol). Use: mix to smooth paste with brush, thin layer on face+neck, massage, 5-15 min until ~80% dry, rinse; follow with moisturizer. Helps: clogged/enlarged pores, blackheads, dull tired skin, sensitive skin detox. Strong social proof on TikTok/Lemon8. For barrier-repair or brightening goals, pair with Claríty Solution activators (anti-aging line).",
  },
  {
    name: "Claríty Skincare Series [B3F1]",
    code: "B3F1SC",
    series: "Claríty Skincare",
    priceMemberMyr: 682,
    priceRetailMyr: 864,
    boxCount: 4,
    contents: ["Buy 3 free 1 — Claríty masks x4"],
    description: "The routine size — 4 boxes for consistent weekly masking.",
    sellingPoints: "Best value step-up from the 2-box starter; ~RM170/box member vs RM239 starter per-box. Same product knowledge as Claríty 2-Box.",
  },
  {
    name: "Claríty Skincare Series [B4F3]",
    code: "B4F3SC",
    series: "Claríty Skincare",
    priceMemberMyr: 1152,
    priceRetailMyr: 1728,
    boxCount: 7,
    contents: ["Buy 4 free 3 — Claríty masks x7"],
    description: "Power-user / share-with-family size.",
    sellingPoints: "Deepest per-box price (~RM165/box member). Position for committed users or besties splitting.",
  },
  {
    name: "Ampoule Boost 3-Box Bundle",
    code: "SET3AMM",
    series: "Claríty Skincare",
    priceMemberMyr: 330,
    priceRetailMyr: 419.7,
    boxCount: 3,
    description: "Concentrated ampoule boosters to layer under the Claríty routine.",
    sellingPoints: "Natural add-on/upsell for any Claríty buyer wanting faster visible glow. Low-ticket entry item too.",
  },
  {
    name: "Ampoule Boost 9-Box Bundle",
    code: "SET9AMM",
    series: "Claríty Skincare",
    priceMemberMyr: 900,
    priceRetailMyr: 1259.1,
    boxCount: 9,
    description: "Ampoule Boost bulk size.",
    sellingPoints: "For ampoule fans — RM100/box member vs RM110 in the 3-box.",
  },
  // --- Claríty Anti-Aging ---
  {
    name: "Anti-Aging Series 2-Box Bundle",
    code: "CLSA",
    series: "Claríty Anti-Aging",
    priceMemberMyr: 488,
    priceRetailMyr: 636,
    pointValue: 48,
    boxCount: 2,
    contents: ["Pick 2: Claríty Solution GLO2 (Glow-Boosting Vitamin C Essence Activator), Claríty Solution REP1 (Repairing & Soothing Essence Activator)"],
    gifts: ["Claríty Toner Pad x3 boxes + Premium Pouch"],
    description: "The Claríty Solution activator duo — repair + glow.",
    sellingPoints:
      "REP1 = 21 actives, soothing/repairing, for stressed, sensitized or pigmented skin. GLO2 = 19 actives with Vitamin C, glow-boosting, preps skin for deeper absorption. Recommend REP1 for sensitive/redness/barrier concerns, GLO2 for dullness/brightening; the pair covers night-repair + day-glow. Generous gift stack (3 boxes toner pads) is a strong closer.",
  },
  {
    name: "Anti-Aging Series 3-Box Bundle",
    code: "CLSB",
    series: "Claríty Anti-Aging",
    priceMemberMyr: 708,
    priceRetailMyr: 954,
    boxCount: 3,
    contents: ["Pick 3 across GLO2/REP1"],
    description: "Anti-aging trio.",
    sellingPoints: "Same knowledge as the 2-box; better per-box (RM236 vs RM244).",
  },
  {
    name: "Anti-Aging Series 6-Box Bundle",
    code: "CLSC",
    series: "Claríty Anti-Aging",
    priceMemberMyr: 1388,
    priceRetailMyr: 1908,
    boxCount: 6,
    contents: ["Pick 6 across GLO2/REP1"],
    description: "Half-year anti-aging supply.",
    sellingPoints: "RM231/box member. For converted fans on a routine.",
  },
  {
    name: "Anti-Aging Series 12-Box Bundle",
    code: "CLSD",
    series: "Claríty Anti-Aging",
    priceMemberMyr: 2738,
    priceRetailMyr: 3816,
    boxCount: 12,
    contents: ["Pick 12 across GLO2/REP1"],
    description: "Full-year anti-aging supply.",
    sellingPoints: "RM228/box member — deepest price; position for loyal customers or sharing.",
  },
  // --- Re.WIND ---
  {
    name: "Re.WIND 2-Box Bundle",
    code: "SET2RWA",
    series: "Re.WIND Hair",
    priceMemberMyr: 419,
    priceRetailMyr: 576,
    boxCount: 2,
    contents: [
      "Pick 2: Scalp Balancing Shampoo, Super Hydrating Shampoo, Glow Hair Mask, Collagen Hair Serum, Hair Re-active Essence",
    ],
    description: "Entry into the Re.WIND 4-step hair ritual (France-formulated, 6-year R&D).",
    sellingPoints:
      "4-step system: CLEANSE → REPAIR → NOURISH → REACTIVE. Protein repairs & smooths cuticles, vitamins for growth/shine/anti-hair-fall, anti-microbial for scalp health. Shampoo picker: oily/combination scalp, yellowish dandruff, odor, scalp acne → Scalp Balancing (woody scent); dry/tight/sensitive scalp, white flakes → Super Hydrating (citrus-floral). Both: gentle pH-balancing, anti-hair-fall, low-foam by design (still deep-cleans; wash twice if oily/styling products; ~40°C water; 1-2 pumps short hair, 2-3 long). Glow Hair Mask: only 2-3 min (fast-absorb, high concentration), daily OK, no silicone fake-slip. Collagen Hair Serum: cream-to-water texture on damp mid-lengths before low-heat blow-dry. Hair Re-active Essence: spray on scalp 2x daily after wash; ~1 month to stimulate follicles; honest scope — helps non-genetic hair loss (scalp/nutrition/damaged follicles); genetic/hairline cases need medical routes. Whole line OK for pregnancy/kids/sensitive scalp. Essential-oil scents (plant-derived).",
  },
  {
    name: "Re.WIND [B3F1]",
    code: "B3F1RWA",
    series: "Re.WIND Hair",
    priceMemberMyr: 682,
    priceRetailMyr: 864,
    boxCount: 4,
    contents: ["Buy 3 free 1 — pick 4 across the Re.WIND line"],
    description: "The full-ritual size — build the complete 4-step routine.",
    sellingPoints: "4 products = the complete CLEANSE/REPAIR/NOURISH/REACTIVE ritual in one order. Same product knowledge as the 2-box.",
  },
  // --- iReason ---
  {
    name: "iReason Trial Package [2 Boxes]",
    code: "SET2IR",
    series: "iReason Eye Health",
    priceMemberMyr: 358,
    priceRetailMyr: 576,
    boxCount: 2,
    gifts: ["Free gift: Premium Towel"],
    description: "USA-formulated eye supplement trial — 38% off retail.",
    sellingPoints:
      "Per 3g sachet: 25.8mg lutein + 5.16mg zeaxanthin in the 5:1 golden ratio (US National Eye Institute recommended) ≈ the lutein of 50 eggs or 27 carrots. 6 patented ingredients: FloraGLO® Lutein (US FDA GRAS — safe even for pregnant/breastfeeding; +520% body lutein in 28 days), Lutemax 2020, Pomanox® pomegranate, Bilberon® bilberry, Sirtmax® black turmeric, Aquamin-F®; plus 8 boosters (goji, maqui, acai, cranberry, yuzu, Fibersol-2, antioxidant premix, vitamin C) — ORAC up to 2 million. Claims: filters up to 90% blue-light damage, REMOVE/PROTECT/ELIMINATE eye-detox story, night-vision & glare recovery. Use: daily care 1 sachet (before breakfast or bedtime); heavy screen users/drivers 2/day (morning = 'sunscreen for the eyes', night = repair). Kids from 3y (supports visual development; myopia/hyperopia/amblyopia support claims). 3-high patients OK. Meds/alcohol: 3-4h gap. Results: weeks to months; no rebound, no dependency. Certifications: ISO22000, HACCP, GMP factory, HALAL. Prevention pitch: even without vision problems, modern screen time depletes lutein the body can't synthesize.",
  },
  {
    name: "iReason Complete Treatment [B3F1]",
    code: "B3F1EH",
    series: "iReason Eye Health",
    priceMemberMyr: 660,
    priceRetailMyr: 1152,
    boxCount: 4,
    contents: ["Buy 3 free 1 — iReason x4"],
    description: "The complete course — 43% off retail.",
    sellingPoints: "Right size for the weeks-to-months results arc at 1-2 sachets/day. Same knowledge as the trial.",
  },
  {
    name: "iReason 4-Month Treatment [B6F2]",
    code: "B6F2EH",
    series: "iReason Eye Health",
    priceMemberMyr: 1310,
    priceRetailMyr: 2304,
    boxCount: 8,
    contents: ["Buy 6 free 2 — iReason x8"],
    description: "The heavy-user course (2 sachets/day for 4 months).",
    sellingPoints: "For drivers, heavy screen workers, parents buying for kids' eye development. RM164/box member. Same knowledge as the trial.",
  },
  // --- Claríty Self-Care specials ---
  {
    name: "[Claríty Self-Care Specials] 3-Box Bundle",
    code: "2026CLA",
    series: "Claríty Skincare",
    priceMemberMyr: 590,
    priceRetailMyr: 864,
    boxCount: 3,
    description: "Limited 'NEVER OFF DUTY 24/7' campaign bundle.",
    sellingPoints: "Campaign pricing beats the regular per-box price — lead with this while it runs. Same Claríty mask knowledge.",
  },
  {
    name: "[Claríty Self-Care Specials] 7-Box Bundle",
    code: "2026CLB",
    series: "Claríty Skincare",
    priceMemberMyr: 1295,
    priceRetailMyr: 2016,
    boxCount: 7,
    description: "Campaign mid-size.",
    sellingPoints: "RM185/box member during campaign. Same Claríty mask knowledge.",
  },
  {
    name: "[Claríty Self-Care Specials] 12-Box Bundle",
    code: "2026CLC",
    series: "Claríty Skincare",
    priceMemberMyr: 2160,
    priceRetailMyr: 3456,
    boxCount: 12,
    description: "Campaign bulk size.",
    sellingPoints: "RM180/box member during campaign — deepest Claríty price on the board.",
  },
  // --- Re.WIND flash deals ---
  {
    name: "[Re.WIND Flash Deal] Bundle A",
    code: "2026RWA",
    series: "Re.WIND Hair",
    priceMemberMyr: 450,
    priceRetailMyr: 864,
    description: "Flash-deal hair bundle — 48% off retail.",
    sellingPoints: "Urgency lever: flash pricing while stock lasts. Same Re.WIND ritual knowledge.",
  },
  {
    name: "[Re.WIND Flash Deal] Bundle B",
    code: "2026RWB",
    series: "Re.WIND Hair",
    priceMemberMyr: 799,
    priceRetailMyr: 1728,
    description: "Flash-deal full-ritual bundle — 54% off retail.",
    sellingPoints: "The biggest saving percentage in the whole catalog — great for closing hair-concern customers fast.",
  },
];

// ---------------------------------------------------------------------------

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@gctopsales.local").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "change-me";

  // 1. Platform admin (no tenant workspace of their own required, but we give
  //    them one so they can use the Playground to test the shared brains).
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      email: adminEmail,
      name: "Platform Admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });

  let profile = await prisma.storeProfile.findUnique({ where: { userId: admin.id } });
  if (!profile) {
    profile = await prisma.storeProfile.create({
      data: { userId: admin.id, storeName: "MAE Demo Store (Admin)", country: "Malaysia" },
    });
  }

  // 2. Brains + markets (updated in place on re-seed so knowledge ships).
  await prisma.storeProfile.update({
    where: { id: profile.id },
    data: {
      homeMarket: "MY",
      marketsServed: JSON.stringify(["MY", "SG", "BN"]),
      identityBrain: JSON.stringify(identityBrain),
      salesBrain: JSON.stringify(salesBrain),
      fulfillmentBrain: JSON.stringify(fulfillmentBrain),
      catalogRules: JSON.stringify(catalogRules),
    },
  });

  // 3. Catalog — upsert by (profileId, code).
  for (const [i, p] of products.entries()) {
    const existing = await prisma.product.findFirst({
      where: { profileId: profile.id, code: p.code },
    });
    const data = {
      profileId: profile.id,
      name: p.name,
      code: p.code,
      series: p.series,
      priceMemberMyr: p.priceMemberMyr,
      priceRetailMyr: p.priceRetailMyr,
      pointValue: p.pointValue ?? 0,
      boxCount: p.boxCount ?? null,
      contents: JSON.stringify(p.contents ?? []),
      gifts: JSON.stringify(p.gifts ?? []),
      description: p.description ?? null,
      sellingPoints: p.sellingPoints ?? null,
      sortOrder: i,
    };
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
    } else {
      await prisma.product.create({ data });
    }
  }

  // 4. A few demo testimonials (real MAE-style results) so the social-proof
  //    feature works out of the box. Agents replace these with their own.
  const demoTestimonials: {
    code: string | null;
    customerName: string;
    market: string;
    resultText: string;
    rating: number;
  }[] = [
    { code: "F01DX", customerName: "Mei, a busy office worker", market: "MY", resultText: "used to only go to the toilet every 3 days — after a week of Total DX+ before bed, it's every morning and the bloating is gone. No cramps at all!", rating: 5 },
    { code: "SET2BC", customerName: "Aunty Lim, 52", market: "MY", resultText: "lost 5kg and 8cm off her waist in her first month on the BCODE+ starter, and says her cravings for supper just disappeared", rating: 5 },
    { code: "B3F2MH", customerName: "Sarah, a working mum of 3", market: "SG", resultText: "finally sleeps through the night and wakes up actually rested — BRB changed her whole mood in about 2 weeks", rating: 5 },
    { code: "SET2IR", customerName: "Mr Tan, a Grab driver", market: "MY", resultText: "his eyes used to be so dry and tired by evening; after a month on iReason the strain from night driving is much better", rating: 5 },
    { code: "SET2CL", customerName: "Xin Yi", market: "MY", resultText: "her pores look visibly smaller and skin brighter after 3 weeks of the Claríty mask — and it never stung her sensitive skin", rating: 5 },
    { code: null, customerName: "Many repeat customers", market: "MY", resultText: "keep reordering because the products actually work and everything is authentic with member pricing and free gifts", rating: 5 },
  ];
  for (const [i, t] of demoTestimonials.entries()) {
    const product = t.code ? await prisma.product.findFirst({ where: { profileId: profile.id, code: t.code } }) : null;
    const exists = await prisma.testimonial.findFirst({
      where: { profileId: profile.id, resultText: t.resultText },
    });
    if (!exists) {
      await prisma.testimonial.create({
        data: {
          profileId: profile.id,
          productId: product?.id ?? null,
          customerName: t.customerName,
          market: t.market,
          resultText: t.resultText,
          rating: t.rating,
          sortOrder: i,
        },
      });
    }
  }

  console.log(`Seeded admin ${adminEmail} + MAE catalog (${products.length} products) + ${demoTestimonials.length} testimonials.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
