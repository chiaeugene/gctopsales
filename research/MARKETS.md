# MAE Markets: Malaysia, Brunei, Singapore — for GC Top Sales multi-market selling

Research date 2026-07-13. Sources: maeglobalofficial.com (region = "MALAYSIA & BRUNEI"), policy pages (MY/SG/HK tabs), SG company registry.

## Market structure (the key model)

MAE operates as **two storefronts** across our three target markets:

1. **Malaysia & Brunei** — ONE shared store, the main site `maeglobalofficial.com` (its region badge literally reads "MALAYSIA & BRUNEI"). Pricing in **MYR (RM)**. This is the catalog GC Top Sales already has seeded.
   - **Malaysia**: free delivery nationwide (no minimum), 3-day processing + 5-7 day delivery, self-pickup at Puchong HQ / Miri / Penang.
   - **Brunei**: served from the same MYR store; cross-border delivery (buyer-paid international shipping unless a local Brunei arrangement/agent applies). Brunei uses Malay + English + Chinese; currency BND (pegged 1:1 to SGD, but MAE quotes MYR from this store). Agents serving Brunei typically arrange delivery/COD locally.

2. **Singapore** — a **separate legal entity**, MAE GLOBAL (SG) PTE. LTD. (UEN 202420173R), 73 Ubi Road 1 #08-54 Oxley Bizhub, Singapore 408733. Pricing in **SGD (S$)**, ships within Singapore. Retail activity registered as cosmetics/skincare + health supplements.

(Hong Kong also exists — MAE GLOBAL (HK) — but is out of our 3-market scope.)

## What this means for the system

- **Currency is market-driven**: MY & Brunei → MYR; Singapore → SGD. GC must quote the right currency for the customer's country and never mix them.
- **MAE Club free shipping covers MY/SG/HK for members** (all tiers) — a shared cross-market membership benefit worth pitching everywhere.
- **Shipping/delivery expectations differ**: MY = free + fast + self-pickup; Brunei = cross-border, confirm delivery method/fee with the agent; SG = local SG courier.
- **Returns** (MY, and SG/HK have their own equivalents): defective/damaged/wrong only, report within 48h with photos, new/unused/original packaging, refund in local currency minus handling fee (RM35 in MY). GC never adjudicates — hand to the agent.
- **SGD prices are not published on the MY site.** The system must let an agent who serves Singapore configure SGD prices per product; until they do, GC serving an SG customer quotes in the agent's configured way (or asks the agent to confirm SGD) rather than quoting MYR to a Singaporean.

## Languages by market

- **Malaysia**: English (Manglish), Mandarin (Chinese-Malaysian majority of MAE's base), Bahasa Malaysia, rojak mix.
- **Brunei**: Malay (dominant), English, some Mandarin.
- **Singapore**: English (Singlish), Mandarin; Malay less common for this product base.

GC already mirrors the customer's language; the market layer just tunes currency + shipping + local flavour.

## Cross-market selling notes

- The **member-vs-retail price gap + free membership** is the universal hook in all three markets.
- **Bundle ladders (BxFy)** and **campaign/flash pricing** run cross-market (seen: Claríty Self-Care specials, Re.WIND flash deals, Jul BCODE+ PWP).
- **WhatsApp is the primary sales channel** across all three markets (MAE's own contact + agents operate on WhatsApp); IG DM and FB Messenger secondary. Chinese-language customers also on Xiaohongshu/Lemon8.
- **Trust signals that travel across markets**: Malaysia Book of Records, Natural Health Readers' Choice (Total DX+), Health & Wellness Brand Award (BRB), NPRA-food classification, SEA HALAL, SGS, GMP & HACCP, batch numbers — authenticity vs grey-market marketplace listings.

## Implementation decision

Model market at two levels:
1. **Agent/tenant** declares which market(s) they serve + their home market (sets default currency + shipping brain).
2. **Per-conversation** GC detects/asks the customer's country when it matters (shipping, currency) and adapts — because one agent may sell to a Malaysian and a Bruneian in the same day.

Product prices: keep the MYR member/retail as the base; add optional per-market price overrides (SGD) an SG-serving agent can fill. If no override and the customer is in SG, GC confirms SGD pricing with the agent rather than guessing.
