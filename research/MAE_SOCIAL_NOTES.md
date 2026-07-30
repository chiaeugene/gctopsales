# MAE Global — social & review platform sweep

Swept 2026-07-30. Scope: SOCIAL and REVIEW platforms only. maeglobalofficial.com product pages were deliberately
left alone (covered by the separate official-site inventory).

Outputs:
- `mae-social-testimonials.json` — 15 testimonials
- `mae-social-assets.json` — 11 infographics, 2 review cards, 3 before/after findings

---

## 1. The headline finding: MAE has almost no organic public review presence

This is the most important thing to tell the user, because it changes the strategy.

MAE is a direct-selling / MLM business that sells through **WhatsApp and closed Facebook groups**. As a result there is
essentially **no independent third-party review corpus** for it anywhere on the open web. What looks like "reviews" is
almost entirely one of two things:

1. **MAE's own marketing graphics** that quote unnamed customers (review cards).
2. **Posts by MAE agents/affiliates** written in first person and styled as reviews.

Concrete evidence of the vacuum:
- **HKTVmall** carries Mae Clarity (SKU B0295002, ~HK$556, 200+ sold) and the review count is literally **zero** —
  the page says 此貨品没有評論.
- **Lazada MY** has MAE Clarity Facial Mask listings, but the one I could see had **1 rating** total. These are
  grey-market/parallel resellers ("Classy Family", "Morane" brand field), not MAE.
- **Shopee MY** — no MAE storefront or product surfaced at all through search.
- **Lemon8** has only a handful of MAE posts and the ones with MAE-branded usernames (`@jiahuimae`) are clearly
  seller accounts.

**Implication for the user:** the honest, defensible testimonial supply for these products is MAE's own review-card
graphics and agent accounts — which means every testimonial must be attributed as such (I have done this in the
`sourceNote` field). Do not let the assistant present these as independent third-party reviews.

A second implication: **Lemon8's own AI writes half of each post.** Every Lemon8 post I fetched had the author's short
real caption followed by a long generated SEO paragraph. One `@jiahuimae` post about MAE Claríty even ends up
recommending **La Roche-Posay** and listing ceramides/niacinamide — ingredients MAE never claims. That padding is not
the author's voice and I did not quote from it except where the sentence is unambiguously first-person experience.

---

## 2. Coverage by product line

| Line | Testimonials found | Infographics found | Comment |
|---|---|---|---|
| Claríty (mask) | 6 (3 MY, 2 SG, 1 HK) | 1 concept graphic | The only line with real spread across platforms |
| Claríty — Skin Perfector | 0 | 2 (incl. the best asset found) | Great graphics, no reviews |
| BRB | 6 (2 MY, 4 HK) | 1 (mechanism + Venus Gan) | Strong content, all MAE-authored |
| Total DX+ | 1 (HK) | 1 (enzyme-deficiency explainer) | Thin |
| Re.WIND | 2 (SG) | 6 (comparison, how-to, 2 ingredient, 2 pain-mirror) | Best infographic coverage, thanks to the microsite |
| **BCODE+ / B-ActV / B-VtrA / B-SynN / B-OriG** | **0** | **0** | Nothing reachable. See below. |
| **iReason** | **0** | **0** | Nothing reachable. |
| **Claríty Anti-Aging (REP1 / GLO2)** | **0** | **0** | Nothing usable. See below. |
| **Total EM+** | **0** | **0** | Nothing reachable. |

### Why BCODE+ and iReason came back empty
Searched under English names, product codes, patented-ingredient names (Reducose, Oleavita, Morosil, Cactinea,
FloraGLO, Lutemax, Pomanox, Bilberon), Chinese marketing phrases (体态管理, 28天), and restricted to
facebook.com / instagram.com / lemon8-app.com. Every result was either MAE's own training PDF on
`images.maeglobalofficial.com` (already in the local `training-pdfs/` set) or an unrelated ingredient-supplier page.
BCODE+ is recent and appears to be sold almost entirely inside closed agent channels. **This is a genuine gap, not a
search failure I can fix without login access.**

### Why Claríty Anti-Aging came back empty
Search engines summarised a Lemon8 post (`@jiahuimae/7556922430346772993`) as reporting "visible reduction in dark
spots and hyperpigmentation" after several weeks. When I fetched the actual post, that sentence **was not there** —
the real text is generic barrier-repair advice plus the La Roche-Posay padding described above. A second candidate
post (`7557676801753907729`, "Discover the Power Duo in CLARITY SOLUTION") returned **HTTP 404**. So I have written
nothing for this line rather than quote a search snippet I could not verify on the page. The existing bank already has
7 Claríty Anti-Aging entries, so this is not urgent.

---

## 3. What blocked me

| Platform | Result |
|---|---|
| **Instagram** | Hard block. `@maeglobalofficial`, `@mae.hairhealthofficial`, `@mae_clarity_cariestylim`, and individual post/reel URLs all return the login wall with **no `og:image`** at all. Zero content extracted. |
| **Facebook** | Partial. Direct `curl` gets a 1.5 KB login stub. WebFetch *can* render public post text and comments, and *can* surface `scontent.*.fbcdn.net` image URLs **with their signature query strings** — that is how the three Claríty review cards were obtained. But I could not browse the page timeline or photo albums, only posts whose URLs I already knew from search. Facebook search itself is login-gated. |
| **fbcdn image URLs** | **Signed and expiring.** The ones harvested carried `oe=` values equal to ~26 Aug 2026. They work today but will 403 later, and a bare unsigned fbcdn URL 403s immediately (verified). **This is why no fbcdn URL is in `mae-social-assets.json`** — see section 4 for how to recover them. |
| **TikTok** | Blocked. Only `/discover/` topic stubs surfaced ("mae-clarity-review", "mae-clarity-mask-review"), which confirms MAE Clarity review videos exist but exposes no post text and no video/thumbnail URLs. JS-rendered as expected. |
| **Xiaohongshu / RED** | Blocked, as expected. Chinese-language searches returned only generic sleep-economy and Lemon8-vs-RED trade articles, never a MAE note. Non-app clients cannot reach it. |
| **HKTVmall** | Reachable, but **0 reviews** on the MAE Clarity SKU. |
| **Shopee MY** | No MAE listing found via search. |
| **Lazada MY** | Reachable; MAE Clarity listings exist but from third-party/parallel resellers with ~1 rating. Not worth mining. |
| **Malaysian/SG beauty blogs** | Nothing new. The known bloggers (Chanwon, Dawn Lee, Mei Fung, Annie) are already represented in the existing bank. No new blog reviews surfaced. |
| **Agent recruitment/training material** | Only the `images.maeglobalofficial.com/.../TrainingFileUrl/...pdf` files, which are already downloaded locally. No new publicly visible training material. |

---

## 4. Two sources that carried the whole sweep

Almost everything of value came from two places, both of which are **MAE-authored but not maeglobalofficial.com**:

### `maerewind.com` — MAE's own Re.WIND brand microsite (WordPress)
An unprotected WordPress uploads directory. Yielded the comparison chart, the 8-step how-to, ~15 ingredient cards,
5 pain-mirror hair-problem photos, and the 8-image before/after gallery. **Permanent, unsigned, curl-friendly URLs.**
I probed for equivalents on the other lines — `maeclarity.com`, `maebrb.com`, `maebcode.com`, `bcodeplus.com`,
`maeireason.com`, `maetotaldx.com`, `mae-clarity.com`, `maeclaritysolution.com`, `maebrbofficial.com` — **all failed
to resolve.** Re.WIND is the only microsite.

Un-inspected siblings worth harvesting if more Re.WIND ingredient cards are wanted (same path, all 200 OK pattern):
`Ingredient-02-2.png`, `Ingredient-04.png`, `Ingredient-05.png`, `Ingredient_2-02.png` … `Ingredient_2-10.png`.
Note they are **transparent-background PNGs with light text** — they need flattening onto a dark background before
they will read correctly in a WhatsApp bubble.

### `hildachung.shop` — MAE's official Hong Kong agent shop (WooCommerce, run by agent Hilda Chung, IG @Mae.Hongkong.hilda)
The single richest agent-run source found. Sells Claríty, Skin Perfector, Ampoule Boost, Hydra Power Serum, BRB and
Total DX+ (**not** BCODE+ or iReason). Also unsigned WordPress uploads. Yielded the BRB mechanism graphic with the
Venus Gan endorsement, the BRB testimonial card, the Total DX+ enzyme explainer, both Skin Perfector graphics, and
the HK-market testimonial quotes. Worth revisiting; I did not exhaust its ~11 product pages.

### The Facebook review cards (recoverable, not stored)
MAE Global MY published three Claríty customer-review card graphics in one post. All three quotes are transcribed
into `mae-social-testimonials.json`. To recover the **images**, WebFetch this post and ask for complete image URLs
including query strings, then curl them immediately:

`https://www.facebook.com/maeglobalmy/posts/962495629324964/`

Two more MAE review videos exist on the same page and were not mined (video, not extractable):
`facebook.com/maeglobalmy/videos/mae-skincare-review/751742172441244/` and
`.../videos/mae-claritys-review-/306535057111028/`.

---

## 5. Before/after: legal exposure assessment

**Short version: two completely different risk profiles, and the user must treat them differently.**

### Re.WIND hair (8 images, maerewind.com) — LOW risk
All shot from **behind the subject**. No faces, no eyes, nothing identifying. I inspected images 01, 04 and 07
directly to confirm this rather than trusting the filenames. The subjects cannot be recognised by anyone, including
themselves. These are MAE's own brand assets on MAE's own domain, so redistribution by an authorised agent is
squarely within normal agent use. The only claim risk is cosmetic ("frizzy → smooth"), which is mild.

### Claríty face (1 image, hildachung.shop) — HIGH risk. Recommend not redistributing.
This is a **full frontal close-up of a recognisable woman's face**, twice, showing active acne, post-acne marks and
freckles. She is not anonymised — the graphic **names her**, stamping @Mae.Hongkong.hilda and Hildachung.shop across
the bottom. It is the HK agent's own face, published by her, about her own skin.

Three separate problems if the user forwards this in sales conversations:

1. **Likeness.** Hilda consented to publishing *her own* photo in *her own* shop. That is not consent for a different
   agent in a different market to send her face to strangers on WhatsApp as generic proof. Portrait/personality rights
   plus PDPA-style personal-data exposure (her face is her personal data, and acne history is arguably health data).
2. **Claim strength.** "6 boxes of Clarity" plus visible acne clearance is functionally a therapeutic claim about a
   product that is a cosmetic. In Malaysia that is the territory of the Medicine Advertisements Board / KKM rules; the
   same logic applies to HK's Undesirable Medical Advertisements Ordinance. Acne before/afters are exactly the
   category regulators pick up on.
3. **No disclaimer.** There is **no results-may-vary wording** in the image or on the page.

### Disclaimer situation generally — this is a real gap
**Not one** of the before/after images or agent product pages I examined carried a results-may-vary /
效果因人而異 / "individual results vary" notice. This is notable because MAE's *own internal training PDFs* are careful
to append "individual results vary" to the BCODE+ 28-day numbers. The discipline is present in the training material
and **absent in the public-facing agent assets.**

### Recommendation
- Re.WIND back-of-head before/afters: safe to use. Still append a results-vary line, since MAE didn't.
- The Claríty face before/after: **do not put this in the assistant's sendable asset library.** If a face
  before/after is genuinely wanted, the user should obtain one from a customer who has given written consent for
  third-party WhatsApp use, or commission MAE for a cleared asset.
- Volume caveat: I could not survey Instagram, TikTok or closed Facebook groups, which is precisely where
  agent-published face before/afters are most likely to be concentrated. **Assume the real number of identifiable
  before/afters across the MAE agent network is much higher than the 1 I could see.** My identifiability finding is
  accurate for what I reached; it is not a complete census.

---

## 6. Honesty ledger

Things I deliberately did **not** do:
- Did not write anything for BCODE+, iReason, Total EM+, or Claríty Anti-Aging — nothing real was reachable.
- Dropped a HK BRB quote about no longer needing sleeping pills (`終於不用再靠安眠藥入睡了`) — implies replacing
  prescription medication.
- Dropped `消炎消腫` (anti-inflammatory / reduces swelling) from the HK Claríty agent quote.
- Dropped the inflammation/bacterial-growth wording from the SG Lemon8 Claríty quote.
- Did not quote the search-engine summary about REP1/GLO2 fading dark spots, because the sentence was absent from the
  actual page.
- Did not quote Lemon8's machine-generated SEO padding as if it were the author's experience.

Things to be aware of in the data:
- **Ratings are inferred from tone, not stated.** None of these sources give a star rating. The 4/5 values follow the
  existing bank's convention, but they are my read of enthusiasm, not published scores.
- **One claim-risky entry is flagged in the file itself**: the "I only used it for 3 days! The acne disappeared…"
  Claríty quote. It is verbatim from MAE's own graphic, but it is the strongest claim in the set and is the kind of
  line that attracts advertising-standards attention. Its `sourceNote` points back to this file.
- **The 6 HK entries are attributable to a single source** (one agent's shop), and the 4 short BRB ones are one-liners
  quoted as anonymous user feedback on a sales page. They are real text I read, but they are weak provenance compared
  to a named reviewer.
- No duplicates of the existing `testimonial-bank.ts` — checked against all 55 entries. The Lemon8 authors already in
  the bank (Dawn Lee, Annie, Mei Fung, Chanwon) are not reused; the new SG Lemon8 entries are a different account
  (`@jiahuimae`, `@whiskbitez`).
