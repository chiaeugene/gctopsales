# MAE Global — visual asset inventory: what I found, what I couldn't reach

Research date: 2026-07-30. Companion file: `mae-asset-manifest.json`.
Scope: MAE Global's **own published** visual assets that an authorized MAE agent could legitimately send to a customer on WhatsApp.

---

## 1. Headline result

**189 assets with verified direct image/PDF URLs.** Every URL in the manifest was fetched with a real HTTP GET, confirmed to return `Content-Type: image/*` (or `application/pdf`), and had its pixel dimensions read out of the file header. Nothing in the manifest is guessed, and nothing is marked `unsure` — I dropped anything I could not verify rather than speculating.

| kind | count |
|---|---|
| PRODUCT (packshots) | 61 |
| INFOGRAPHIC | 46 |
| OTHER (banners, awards, brand, diagnostics, gifts) | 42 |
| PRICE_CARD (bundle/campaign cards) | 37 |
| CERT | 3 |
| LABEL | 0 |

| product line | count |
|---|---|
| Re.WIND | 70 |
| BCODE+ | 30 |
| GENERAL | 26 |
| Claríty skincare | 25 |
| Claríty Anti-Aging | 16 |
| BRB | 11 |
| Total DX+ | 6 |
| iReason | 4 |
| Total EM+ | 1 |

All 8 product lines are covered. Coverage is thin for **iReason** (4 assets) and **Total EM+** (1 packshot). See §6.

Assets came from five sources, and the two I stumbled onto turned out to matter most:

| source | assets | what it gave |
|---|---|---|
| `api.maeglobalofficial.com` public catalogue API | 85 | every packshot and bundle card, in one request |
| `www.maeglobalofficial.com` static `/images/` tree | 47 | the website infographics + the BCODE+ trust card |
| **`maerewind.com`** — MAE's separate bilingual Re.WIND microsite | 50 | **the richest single find**: standalone EN *and* ZH ingredient cards, the 8-step usage guide, transparent-background packshots |
| Lazada / HKTVmall listings carrying MAE's own artwork | 5 | including the Claríty certification board |
| **`images.maeglobalofficial.com`** training-file host | 2 | the NPRA cosmetic-notification deck and the iReason deck |

---

## 2. How I got the URLs (worth knowing — it's repeatable)

`maeglobalofficial.com` is a **Next.js SPA on Vercel**. This matters:

- The **homepage HTML contains exactly one image URL.** A naive scrape returns almost nothing. This is probably why earlier research concluded the brand pages were "image-only" and stopped.
- **Canonical host is `www.`** — the apex domain 307-redirects, and `curl` without `-L` silently returns `Redirecting...`. Any scraper that doesn't follow redirects gets empty files.
- `sitemap.xml` lists only **10 pages** and **no product pages at all**. It is useless for discovery.
- The real brand pages are **not in the sitemap**: `/BCODE`, `/BRB`, `/ClaritySolution`, `/ReWind`, `/SkinCareSeries`. These *are* server-rendered and their `<img src>` paths are in the HTML — this is where all the infographics live, under `/images/<line>/`.
- Product detail pages (`/Product/<slug>-<CODE>`) are **client-rendered and contain zero image URLs**. The packshots come from an API.
- The API is **`https://api.maeglobalofficial.com`**, discovered by pulling the `_next/static/chunks/*.js` bundles and grepping for fetch targets. Two endpoints matter and **both are public, unauthenticated, and CORS-open**:
  - `GET /ProductCategory/category-names/{REGION}` where REGION ∈ `MALAYSIA | SINGAPORE | HONGKONG | BRUNEI` — returns the **entire catalogue** (88 unique SKUs across the four regions) with an `image` field per product. This is the single most useful endpoint.
  - `GET /products/{slug}` — one product, same `image` field plus a `moreImages` array.
  - `GET /products/web-settings/hero` — the current campaign hero.

**Practical note for whoever maintains this:** re-running `GET /ProductCategory/category-names/MALAYSIA` refreshes the whole packshot + bundle-card set in one request. The `image` filenames are random hashes (e.g. `/images/products/F01DX/nqtjmtg3piv.png`), so **they will change when MAE re-uploads artwork**. Treat the manifest URLs as a snapshot and re-pull periodically rather than hardcoding them forever.

### Nothing blocked me on MAE's own properties
No Cloudflare challenge, no rate limiting, no bot detection, no login wall on any public page or the catalogue API. `robots.txt` disallows only member-account paths (`/dashboard`, `/account`, `/orders`, `/wallet`, etc.), which I did not touch.

---

## 3. What I could NOT reach

### 3.1 The agent training centre — login-walled (this is the big gap)
There **is** a training centre, and it is almost certainly where MAE keeps the polished, agent-ready sales collateral. I found the route `/training` and its API surface in the JS bundles:

```
GET /api/training/categories
GET /api/training/categories/{id}/browse
GET /api/training/categories/{id}/items
GET /api/training/modules            /modules/{id}   /modules/{id}/progress
GET /api/training/modules/{id}/quiz  /quiz/{id}/attempts   POST /quiz/attempt
GET /api/training/progress
```

Every one of these returns **HTTP 401** unauthenticated. I did not attempt to bypass authentication.

**What a human needs to do instead:** log in to `maeglobalofficial.com` as a MAE member/distributor, open `/training`, and export the media. The API shape (`categories → items`) suggests a browsable media library. An authorized agent could hit `/api/training/categories` with their own session token and get a complete, structured list of official collateral — which would very likely beat everything in this manifest for the infographic and certificate categories. **This is the highest-value next step.**

Related member-only routes also exist and are robots-disallowed: `/distributors`, `/sales-figure`, `/bonus`, `/vouchers`, `/yearly-summary`.

### 3.2 Certificates are not on the storefront — but three real ones exist elsewhere
There is **no** `/images/cert/` directory on `maeglobalofficial.com`, no downloadable halal certificate, and no certificate scan of any kind on the storefront. On the website the certification story appears only as one composite trust card (`bcode_bottom.webp`) plus certification **logo rows baked inside** the long-form product infographics.

The three genuine `CERT` assets in the manifest all came from **off** the storefront:
1. **`bcode_bottom.webp`** — MAE's BCODE+ free-from + certification-marks card (on the website).
2. **The Claríty certification board** — found on a Lazada reseller listing but unmistakably MAE's own artwork: two SGS pH 5.5 reports on mae letterhead, the Malaysian **Cosmetic Notification** certificate, and the **SEA Halal** certificate (Halal Food Council International).
3. **The 15-page NPRA Cosmetic Notification deck** for all five Re.WIND products, on MAE's training-file host — with **real notification numbers** (see §5.4b). **These notifications all expired in 2025.**

Two honest caveats on halal and NPRA:
- MAE's halal mark is **HFCI (Halal Food Council International, Malaysia & Asia Region)**, **not JAKIM**. Worth knowing before an agent claims "JAKIM halal" to a Malaysian buyer. No halal certificate *number* is published anywhere I could reach.
- There is no `MAL…` number for the supplements, and there shouldn't be: they are classified as **food**, not registered medicines (see §5.3). The cosmetics have `NOT…` notification numbers instead, which is the correct regime for them.

### 3.3 No LABEL assets
I found no back-of-pack / nutrition-panel / registration close-up images published anywhere public. The `LABEL` category is empty. These would have to come from the training centre or from photographing stock.

### 3.4 Product copy is images, not text
Only **1 of 88 products** (Total DX+) has any text in its API `description` field. Every other product's marketing copy, ingredient list, mechanism explanation and usage instruction exists **only as pixels inside the infographic images**. There is no text layer to scrape. This is why §5 below transcribes the text out of the images by eye — it's the only way to get it.

### 3.5 The training-file host — partially open, and worth pursuing
`https://images.maeglobalofficial.com/` responds 200. The training bucket path is:

```
https://images.maeglobalofficial.com/images/uploads//TrainingFileUrl/<guid>/<filename>.pdf
```

The directory itself returns **403 with no listing**, so files are reachable only if you already know the exact GUID path. I got two by finding search-engine-indexed URLs — and both were valuable (the NPRA deck and the iReason deck). The local `research/training-pdfs/ireason_eyehealth.pdf` is **byte-identical** to what this host serves, which confirms the existing local PDFs came from here.

**Implication:** MAE's whole agent collateral library almost certainly sits on this host, publicly readable, indexed only patchily. An authorized agent logged into `/training` would see the GUIDs directly via `/api/training/categories/{id}/items` and could enumerate the lot.

### 3.6 External sources
Marketplace and social findings are in §7 and §8.

---

## 4. Practical guidance for using these assets on WhatsApp

**Read this before wiring the manifest into the assistant.**

1. **Prefer the `01…` codes for default packshots.** MAE maintains two parallel image sets. Codes beginning `01` (from its "MAE PRODUCTS" catalogue) are **clean cut-outs on plain white — box plus sachet, no props**. These are the correct default for a chat message. The base codes (`F01DX`, `B02ACTV`, `R01OIL`, …) are hero shots **styled with the product's signature raw ingredients** (broccoli and melon for B-SynN, olive and mulberry for B-ActV, blood orange and prickly pear for B-VtrA, soy and beetroot for B-OriG, moringa and raspberry for Total DX+). Use those when you're telling the ingredient story — they're better for that, worse as a plain "here's the product".
2. **Bundle "packshots" are actually price cards.** Every `SET…`, `B?F?…`, `BCSET…`, `CLS…`, `2026CL…`, `NNSE/NSDD/NSPP` image is a **campaign card** ("BUY 8 FREE 1") showing the boxes and the free gifts. **None of them print prices.** The assistant must always state member vs retail price in the message text. Do not let it imply the card shows the price.
3. **The long infographics must be cropped, not sent.** Several are absurdly tall: Claríty skincare part 1 is **1575 × 8191**, Re.WIND part 1 is **1200 × 7136**, Claríty Solution part 1 is **2400 × 6291**. WhatsApp will compress these into illegibility. Slice out the single panel that answers the customer's question. The best individual crops are flagged in each asset's `note`.
4. **Campaign cards go stale.** The `2026CL*` and `BCSET*` cards carry live campaign text ("Never Off Duty", "JUL CAMPAIGN PWP EXCLUSIVE", "MAX 3 BOXES"). They will be wrong next month. Anything the assistant sends with campaign copy on it needs a freshness check, or it will quote an expired promotion to a customer.
5. **Don't send the corporate WhatsApp QR** (`WhatsApp-QR.jpg`) unless you are genuinely handing the customer to MAE's official CS line (+6018-358 0900). An agent sending it mid-sale routes their own customer away from them.
6. **Small assets are decorative, not informational.** `B-ActV-Use.webp` and its siblings (445×475) sound like usage infographics from the filename but are just **single-line drawing icons** — a sachet and a face outline, no text. I checked. Likewise `brb/how1.webp` and `how2.webp` (244×89) are captions, not diagrams. I kept these out of the manifest.
7. **⚠ Flatten the transparent PNGs before sending.** Everything from `maerewind.com` that is a `.png` — all 28 ingredient cards, both direction-of-use guides, and the `IMG_*` bottle cutouts — has a **transparent background**. WhatsApp does not honour alpha: it composites transparency to **black**, so a beautiful ingredient card arrives as white-on-black and looks broken. Composite each one onto a white canvas at import time. This affects roughly a quarter of the manifest and is the single easiest way to ship something embarrassing.
8. **Serve the 1600px variants, not the originals.** WordPress reports the original dimensions in its API (some are 3334×2501, one is 8000×4500) but the URLs in this manifest resolve to the ~1600px-max resized files, which is right for chat. Don't "upgrade" to the originals.
9. **Use the Chinese variants.** `maerewind.com` publishes a full parallel Chinese set (all 10 ingredient cards, the 4 herbal-extract cards, two banner variants), and the BRB Lazada assets are bilingual. Given MAE's Malaysian-Chinese customer base, language-matching the asset is a cheap, large credibility win.

---

## 5. Text worth reusing (transcribed from MAE's own published images and documents)

### 5.1 The 13 international patented functional ingredients in BCODE+
Verified by reading MAE's own logo board (`/images/bcode/13_int_mobile.webp`). **This corrects the existing research notes** — two of the thirteen were previously unrecorded:

> SUPERFINOL™ · GliSODin® · Ioniplex® · OleaVita™ · LALMIN® · **GARXLIM™** · trueBroc® · Fibersol®-2 · Fibruline™ · MOROSIL™ · Reducose® · Cactinea™ · DigeSEB®

`GARXLIM™` (Garcinia Cambogia extract) and `SUPERFINOL™` were missing from `MAE_RESEARCH.md`. GARXLIM is confirmed as a B-ActV ingredient by the KKM filing (§5.4).

### 5.2 MAE's official compliance/free-from card — verbatim
From `/images/bcode/bcode_bottom.webp`. Six free-from claims:

> Hormone Free · GMO Free · No Artificial Flavours & Colours · Preservatives Free · No Added Prohibited Substances · Suitable For Vegetarians

And MAE's own disclaimer, which the assistant should mirror **word for word** rather than inventing its own:

> "\* These products are not intended to diagnose, treat, cure, or prevent any disease. Results may vary. Individuals with medical conditions should consult a healthcare professional before use."

Certification marks shown on that card: **Tested By SGS · GMP (Good Manufacturing Practice) · HACCP Certified · ISO 22000 Food Safety · HALAL (Halal Food Council International, Malaysia & Asia Region)**.

The Claríty skincare page carries its own mark row: **GMP · HACCP · ISO · pH5.5 · HALAL · Tested By SGS**, plus "SUITABLE FOR ALL SKIN TYPES / GENTLE & SKIN-FRIENDLIEST pH5.5".

### 5.3 KKM / regulatory classification — the compliance line that matters
From MAE's own KKM filings (local file `research/training-pdfs/kkm_classification.pdf`). The operative sentence, in Malay:

> "…produk di atas merupakan produk yang **TIDAK DIKAWAL** oleh Pihak Berkuasa Kawalan Dadah (PBKD)."

i.e. **not controlled by the Drug Control Authority** — regulated as food under the **Akta Makanan 1983** and **Peraturan-Peraturan Makanan 1985**, administered by the **Program Keselamatan dan Kualiti Makanan (Food Safety and Quality Programme), Kementerian Kesihatan Malaysia**. This is exactly why there is no `MAL` number: MAL numbers are for registered medicines/health supplements under NPRA, and BCODE+ is classified as food. If a customer asks "why no MAL number", that is the correct, honest answer — and it supports the "functional food, not medicine" positioning MAE already uses.

KKM letter reference: **KKM.600-7/2/1 Jld. 575**, dated **25 November 2025**.

### 5.4 KKM application numbers + full legal product names (with patented ingredients)
Transcribed from the compliance PDF, one filing per BCODE+ code:

| Code | No. siri permohonan | Legal product name as filed |
|---|---|---|
| B-SynN | 041125/10/235 | BCODE+ B-SYNN (Botanical Beverage Mix Vegetables & Fruits with Fermented Super Berries Essence Powder, **Truebroc®** Broccoli Seed Extract Powder, **Glisodin®** Melon Extract Powder & **Ioniplex®** Fulvic Ionic Mineral Complex) (powder in sachet) |
| B-ActV | 041125/10/236 | BCODE+ B-ACTV (Botanical Beverage Mix Mulberry Leaf Extract Powder, **Garxlim™** Garcinia Cambogia Extract, **Morosil®** Blood Orange Extract, **Oleavita™** Olive Leaf Extract & Bitter Melon Extract) (powder in sachet) |
| B-VtrA | 041125/10/238 | BCODE+ B-VTRA (Botanical Beverage Mix Lemon Powder, **Morosil™** Blood Orange Extract, Prickly Pear Extract Powder, Tea Extract & **Lalmin®** Selenium Yeast Extract) (powder in sachet) |
| B-OriG (Beetroot) | 301025/10/239 | BCODE+ B-ORIG (BEETROOT) (Botanical Beverage Mix Isolated Soy Protein Powder, Yeast Protein Powder, Beetroot Powder, White Kidney Bean Extract & Potato Extract Powder) (powder in sachet) |
| B-OriG (Chocolate) | 301025/10/237 | BCODE+ B-ORIG (CHOCOLATE) (Botanical Beverage Mix Isolated Soy Protein Powder, Yeast Protein Powder, Chocolate Powder, White Kidney Bean Extract & Potato Extract Powder) (powder in sachet) |

Note **White Kidney Bean Extract** and **Potato Extract Powder** in B-OriG — the potato extract is the Slendesta satiety ingredient. Neither was in the existing notes.

SGS test report numbers on file (B-SynN / B-ActV shown; the pattern repeats per code):
`HNSA/251062083-AH50610` (08-Oct-2025), `HNSA/251165240-AH58101`, `HNSA/251165229-AH58100` (both 12-Nov-2025) for B-SynN;
`HNSA/251062083-AH50611`, `HNSA/251165240-AH58103`, `HNSA/251165229-AH58102` for B-ActV.
Sample markings appear as `BCODE+ B-SYNN (S2971 J25)` and `BCODE+ B-ACTV (S2968 J25)`.

### 5.4b NPRA cosmetic notification numbers (Re.WIND) — from MAE's own compliance deck
Transcribed from the 15-page Cosmetic Notification PDF on MAE's training-file host. Issued under **Control of Drugs and Cosmetics Regulation 1984, Regulation 18A(2)**, by the **Director of Pharmaceutical Services, Ministry of Health Malaysia**:

| Product | Notification number | Validity period |
|---|---|---|
| RE.WIND SCALP BALANCING SHAMPOO | **NOT230905848K** | 23/09/2023 – 23/09/2025 |
| RE.WIND SUPER HYDRATING SHAMPOO | **NOT230905846K** | 23/09/2023 – 23/09/2025 |
| RE.WIND GLOW HAIR MASK | **NOT230905847K** | 23/09/2023 – 23/09/2025 |
| RE.WIND COLLAGEN HAIR SERUM | **NOT230905845K** | 23/09/2023 – 23/09/2025 |
| MAE RE.WIND HAIR RE-ACTIVE ESSENCE | **NOT231003608K** | 15/10/2023 – 15/10/2025 |

**⚠ Every one of these has expired** (today is 2026-07-30). The assistant must not present them as current registration. Ask MAE for the renewed notification numbers.

Each notification is followed by two SGS test-report pages: **Arsenic (As)** — EPA Method 3051A/3052 — result **N.D.**; **Total Aerobic Microbial Count** — United States Pharmacopoeia 2021 Chapter 61 — result **N.D.** (MDL 10 cfu/g). Job refs `C&P/2023-10-16-012`, `C&P/2023-10-17-013`, `C&P/2023-10-17-014`, `C&P/2025-02-25-013`.

The notification note carries its own disclaimer, which is worth knowing before an agent oversells it:
> "This notification number is auto-generated based on the declaration of compliance to the directives of the Director of Pharmaceutical Services by the company. The notification number should not be taken as a guarantee for cosmetic safety, quality and claimed benefit. As such, the notification number is not to be commercialized."

That last clause — **"not to be commercialized"** — means an agent should use the notification to *reassure* on request, not to advertise with. Worth encoding as a guardrail.

### 5.4c Re.WIND full active-ingredient list — from MAE's own bilingual cards
The `maerewind.com` card set names each active with its benefit line, in English and Chinese. This is the most complete Re.WIND ingredient data available and it isn't in the existing notes:

| Ingredient (EN) | Benefit (MAE's wording) | Chinese |
|---|---|---|
| Anemarrhena Asphodeloides Root Extract | Alleviate scalp inflammation | 知母根提取物 / 减轻头皮炎症 |
| Zingiber Officinale (Ginger) Root Extract | Promoting hair growth | 姜根提取物 / 促进毛发生长 |
| Algae Extract | Beneficial for follicle health | 海藻提取物 / 有益于毛囊健康 |
| Urtica dioica (Nettle) Leaf Extract | Provides vitamins, minerals and polyphenols to prevent hair loss and enhance hair texture | 荨麻提取物 / 强健发质不易脱发 |
| Sesamum Indicum Seed Extract | Promote hair growth | 芝麻籽提取物 / 促进头发生长 |
| Arginine | Follicles & stimulating hair growth | 精氨酸 / 刺激毛发生长 |
| Niacinamide | Improved hair appearance & texture | 烟酰胺 / 提升头发的外观和质感 |
| Pyridoxine & Panthenol | Strengthening hair quality & maintain scalp health | 吡哆醇、泛醇 / 增强发质和维持头皮健康 |
| Biotin | Prevents premature graying | 生物素 / 预防现代人常见的少年白发 |
| Tripeptide-1 | Slow down follicle aging | 三肽-1 / 延缓毛囊衰老 |
| Aesculus Hippocastanum (Horse Chestnut) Seed Extract | Effectively helps strengthen hair follicles and combat hair loss | 欧洲七叶树籽提取物 |
| Equisetum Arvense Extract | Stimulates hair growth & enhances blood circulation, resulting in healthier hair follicles | 麻尾草提取物 |
| Avena Strigosa Seed Extract | Contains water-retaining elements like amino acids that help hold onto its natural moisture | 糙伏毛燕麦籽提取物 |

Plus the imported patented **HAIR COMPLEX 3** (see §5.6) and the Hair Re-active Essence's four traditional herbs (Biota Orientalis leaf, Panax Ginseng root, Angelica Polymorpha Sinensis root, Polygonum Multiflorum root).

### 5.4d iReason — the six trademarked actives, verbatim
From MAE's archived iReason page (the live site has no iReason page at all):
> "6 TRADEMARKED / PATENTED INGREDIENTS FOR COMPLETE EYE NUTRITION — POMANOX® pomegranate powder, BILBERON® bilberry, SIRTMAX® (Curcuma caesia), FLORAGLO® lutein, LUTEMAX 2020 (lutein & zeaxanthin), AQUAMIN-F® (natural minerals)"

and

> "GOLDEN RATIO 5 LUTEIN : 1 ZEAXANTHIN — Each serving contains: Lutein > 10mg, Zeaxanthin > 2mg"

⚠ Note this conflicts with the 25.8 mg / 5.16 mg figures in `MAE_RESEARCH.md` — see §10.

Certifications MAE cites for iReason: ISO 22000, HACCP, GMP factory, HALAL, plus a lutein assay report and nutrition-fact tests.

### 5.5 MAE's own published typical-results wording

**Re.WIND** (from `/images/rewind/MAE-Website_Re.WIND_2.webp`) — "REVITALIZING THE HAIR WITH JUST 1 USE / Experience the silky and smooth hair with every comb":
> **+92%** Silky & Smooth · **+89%** Nourishment & Moisture · **+85%** Hair Strength · **+79%** Voluminous

**Claríty Solution** (from the Anti-Aging page): "AWAKEN YOUR SKIN FROM WITHIN — Reveal a Youthful Glow in Just **20 days**", and "Reverse 6 Visible Signs Of Aging" / "**TRIPLE ANTI-AGING POWER** — antioxidation | anti-inflammation | antiglycation".

**Claríty skincare**: Malaysia Book of Records — "**Highest Powder Face Mask Sales Value In A Day**".

**BRB** (from `/BRB`, under "PROVEN EFFECTIVENESS … \*After 2 months"): 80% improved sleep quality · 75% more attentive · 92% emotional well-being improved · 58% athletic performance improved.

**BCODE+ — read this carefully, it changes how the assistant should talk about weight.** The 28-day figures in `MAE_RESEARCH.md` (weight −4–8 kg, body fat −3–6%, visceral fat −1–2 levels, waist −5–10 cm) come from the internal training FAQ. **MAE's public BCODE+ page carries no kilo figures at all** and has been deliberately written claim-light. Its actual published wording is:

> "WHAT YOU MAY EXPERIENCE … users may experience: A more consistent daily routine / Improved awareness of eating habits / Feeling lighter and more comfortable / Sustained energy throughout the day / A general sense of improved well-being"
> "\*\*Individual experiences may vary."

and it explicitly de-positions weight loss:

> "Is BCODE+ only for people who want to manage weight? No. BCODE+ is designed to support general wellness and daily nutritional balance, regardless of individual wellness goals."

So any hard kilogram number is **agent/training-level, not corporate-published**. The assistant should follow MAE's public voice, not the internal FAQ, when talking to a customer — the internal numbers are for answering a direct question with the "individual results vary" caveat, not for making the pitch.

### 5.6 Mechanism explanations published as images

- **BRB** (`/images/brb/Main4.webp`): Nicotinamide Mononucleotide (NMN) — "To boost performance and improves balance, protects against DNA damage, and helps you look younger" — overlapping **THREE ADAPTOGENS** (Ashwagandha Extract, Rhodiola Extract, Valerian Root Extract) — "To help balance, restore and protect the body".
- **BRB 8 benefits** (`Brb-8b.webp`): Boost Performance · Anti-Aging · Improve stress tolerance · Reduce fatigue · Improve sleep quality · Mood Relaxation · Increase athletic endurance · Boost Immune System.
- **BRB dual mode** (`Day_Night.webp`): "DUAL MODE SYSTEM — THE PERFECT DAY & NIGHT ESSENTIAL. DAY: Boost Productivity at Work / stay energetic & productive. NIGHT: Better Sleep and Relaxation / stay calm for a better night's sleep."
- **Re.WIND HAIR COMPLEX 3** (`MAE-Website_Re.WIND_1.webp`): imported patented complex of **Triticum Aestivum (wheat) seed extract, Oryza Sativa (rice) bran extract, Glycine Max (soybean) seed extract**, using "pressurised hot water extraction … instead of traditional extraction methods involving chemical solvents". Tagged anti-oxidation / anti-microbial / scalp repair. Plus "10 NATURAL HERBAL INGREDIENTS".
- **Re.WIND Hair Re-active Essence** star ingredients: Biota Orientalis Leaf Extract, Panax Ginseng Root Extract, Angelica Polymorpha Sinensis Root Extract, Polygonum Multiflorum Root Extract → "Awaken Hair Follicles / Prevent Hair Loss / Promotes Hair Growth / Strengthens Hair Roots".
- **Claríty Solution aging mechanism**: a "VICIOUS CYCLE OF AGING" triangle — **OXIDATION** (UV light / stress / alcohol / smoking / radiation / pollution), **GLYCATION** ("Damages collagen, speeds up sugar binding" — processed foods / high-sugar diet), **INFLAMMATION** ("Irritation from skincare products / chemical irritants / temperature changes & dry climate").
- **Claríty mask**: "Deep Cleansing — Thoroughly removes impurities, excess oil, and pollutants to purify your skin, preparing it for better absorption of nutrients." / "Skin Barrier Repairing — Repairs your skin cells and restores its natural protective barrier, helping it retain moisture, prevent irritation, and shield against harmful elements." Named actives: **Calendula Officinalis Flower Oil**, **Pearl Powder**.

### 5.7 Two usage guides worth cropping and reusing verbatim

**Re.WIND 8-step DIRECTION OF USE** (inside `MAE-Website_Re.WIND_2.webp`):
1. Comb out tangles → 2. Wet the hair thoroughly → 3. Wash with Re.WIND Scalp-Balancing Shampoo / Super Hydrating Shampoo → 4. Squeeze out excess water → 5. Apply Re.WIND Glow Hair Mask, leave for 3–5 mins and rinse → 6. Wrap hair in a towel → 7. Apply Re.WIND Collagen Hair Serum and blow-dry → 8. Spray Re.WIND Hair Re-active Essence on the scalp and massage until absorbed.

**MAE SKINCARE GUIDELINES FOR DIFFERENT SKIN TYPES** (inside `MAE_Skin-Care-Series_3.webp`) — a frequency matrix for Claríty / Hydra Power Serum / Skin Perfector & Air Blur Cushion across Dry, Oily, Combination, Sensitive and Acne-Prone skin, with each type's tell-tale signs. Examples: Dry skin — Claríty once every 3–4 days; Oily skin — start consecutively for 7 days, later once every 2–3 days; Acne-prone — start consecutively for 4–5 days, later every 2–3 days, and add Hydra Power Serum after 1 week of Claríty. **Crop this table and send it after identifying the customer's skin type** — it's the most professional-looking asset in the skincare line.

Claríty mask cautions on the same page: "Apply a thicker layer on acne-prone areas for faster healing. Focus on massaging areas with blackheads, whiteheads, or pigmentation. Avoid the eye area, especially the eyelids and undereyes. You can continue with your regular skincare product after using Claríty (e.g. toner, serum, moisturizer)."

---

## 6. Gaps in coverage by line

- **iReason** — still worst covered. MAE publishes **no** `/iReason` brand page (the old one was taken down) and **no** standalone iReason packshot in the catalogue. The only assets are the three bundle cards (`SET2IR`, `B3F1EH`, `B6F2EH`), which do at least show the boxes, plus the **8-page iReason deck PDF** now in the manifest with a live URL. **Action:** export that deck's 8 pages to images — that is the whole iReason visual library.
- **Total EM+** — one packshot (`F02EM`) plus the Healthcare bundle cards. No dedicated infographic.
- **Re.WIND** — by contrast, now the best-covered line by a wide margin (70 assets), entirely because of the `maerewind.com` microsite. Worth checking whether MAE runs equivalent microsites for the other lines; I found none, but I only knew to look for this one because a search surfaced it.
- **BRB Roll On 01 / 02** — **completely absent** from MAE's public catalogue and website. No packshot, no page, no infographic, despite the product having its own training FAQ. Either discontinued online or sold only through agents.
- **Claríty Toner Pad / Cleansing Sponge** — only as a combined gift image (`GIFT`).
- **Total Vita+** — gone, as expected (superseded by B-VtrA).
- **CERT** — only one composite card, and it's branded to BCODE+. No per-line certificate assets exist publicly.

---

## 7. Marketplace listings (Shopee MY / Lazada MY / HKTVmall)

**There is no official MAE store on any of the three.** Every Malaysian listing found is a third-party reseller or agent; the HKTVmall Claríty REP1 listing is explicitly labelled "Parallel Import". Some of those resellers nonetheless upload MAE's own artwork, and **five of those images were good enough to include** — most importantly the Claríty certification board, which exists nowhere on MAE's own site.

| site | result |
|---|---|
| **Shopee Malaysia** | **Fully blocked.** Every product page returns an identical ~162 KB JS shell — no `<title>`, no `og:` tags, no product JSON, zero CDN image paths. The data APIs (`/api/v4/pdp/get_pc`, `/api/v4/search/search_items`) return **HTTP 403** with `{"error":90309999,"redirect_to_error_page":true}`. **Zero Shopee image URLs obtained, and none constructed.** |
| **Lazada MY/SG** | **Partially blocked.** Search, tag and catalog pages are JS shells; `?ajax=true` triggers a `_____tmd_____/punish?x5secdata=…` anti-bot redirect. **Individual product pages render fully server-side**, so listings had to be located via search engine and then fetched one at a time. Several MAE listings are dead (404). |
| **HKTVmall** | **Product pages open, search blocked.** Direct product URLs return full server-rendered HTML with usable CDN images; `/hktv/*/search?q=…` returns a JS-rendered grid with no product data. Only two MAE product pages were reachable, both via search engine. |

The five included assets are in the manifest with `sourcePage` pointing at the listing. Every one carries the caveat that it is a **reseller upload** — the URL is not under MAE's control and can vanish. I deliberately **excluded** reseller-made composites: chat-screenshot testimonial grids, KOL collages, an "AI-looking" forest-background pack shot, and a Chinese Claríty card asserting "回购率99%" (an unverifiable agent-authored claim).

## 8. Official social channels (Facebook / Instagram / TikTok / YouTube)

**Verdict: social is not a usable asset library. Do not build against it.**

| platform | status |
|---|---|
| Facebook | `facebook.com/maeglobalmy/` (~17.8k likes, primary) and `facebook.com/officialmaeglobal/` (~1.2k likes) both exist |
| Instagram | `instagram.com/maeglobalofficial/` — ~13k followers, ~1,118 posts |
| Xiaohongshu | `xiaohongshu.com/user/profile/6332c7da000000002303f56e` (redId `maeglobal`) |
| Re.WIND microsite | `maerewind.com` — **live, and the best source in this entire report** |
| **TikTok** | **No official account found.** `@maeglobalofficial` and `@maeglobal` both return TikTok's WAF challenge page, not a profile |
| **YouTube** | **No official channel exists.** `youtube.com/@maeglobalofficial` 404s; `@maeofficial-com` is an unrelated Dutch hair company; `@maeglobal` has zero videos. MAE's own "FIND US ON" footer — checked live and in every Wayback snapshot back to 2022 — has only ever listed the two Facebook pages, Instagram and Xiaohongshu. **So there are no stable `i.ytimg.com` thumbnails to harvest.** |

Why the platforms that *do* exist are still unusable:

- **Facebook / Instagram** — requesting with a `facebookexternalhit/1.1` user-agent does make Meta serve a real `og:image` CDN URL without login, and those URLs fetch fine. But they are **signed and expiring** (the `oe=` parameter on one sampled Facebook image decoded to ~4 days out), they give **one image per post URL**, and **the feed cannot be enumerated** — the profile page is a login shell and the old `/embed/captioned/` leak now renders via JS. Usable for a one-off manual pull, useless as a library.
- **Xiaohongshu** is the surprise: the profile is **fully server-rendered**, and a plain `curl` returns ~878 KB of HTML containing 30 note titles paired with 30 cover-image URLs. But the CDN paths embed a timestamp segment (`202607301746/…`) and **rot**, and note IDs aren't in the SSR HTML so individual posts can't be deep-linked. Also see §9 — this is where MAE posts face-visible customer content.
- **TikTok** — WAF/JS, no fallback.
- **Agent Instagram accounts** (`mae.clarity.christine`, `mae.rewind.clees`, `mae.eternitybeauty`, `_maemalaysia_`, `mae_clarity_my`) are all login-walled. **Not a single image verified** from any of them.

---

## 9. Before/after images — assessment

Full detail in the `beforeAfter` array of `mae-asset-manifest.json` (12 entries). The short version:

**Yes, MAE publishes before/after — and the pattern is unusually clean.**

**MAE's storefront publishes none.** I probed 15 plausible paths (`/Testimonial`, `/Results`, `/Reviews`, `/Stories`, `/Success`, `/Gallery`, …) — all 404. Grepping every product page for `testimonial|before.*after|见证|前后|对比` hit only the CSS selector `*::before,*::after`.

**Where MAE does publish comparisons, they are anonymised by camera angle.** Two sets, both safe:
- **`maerewind.com` "Viable Results"** — 8 files literally named `Before-After-01..08`, all verified 200 `image/jpeg` at 1600×1600. I opened one: side-by-side BEFORE | AFTER of the **back of a woman's head** on a cream branded backdrop. No face, no name, no tag.
- **The "VISIBLE RESULTS CAN BE SEEN" grid** inside MAE's official Re.WIND infographic on the main site (`MAE-Website_Re.WIND_2.webp`) — six BEFORE|AFTER pairs, all hair/scalp/back-of-head crops. Corporate-published, non-identifiable.

**One ownership caveat you should resolve before using the `maerewind.com` set:** the site carries MAE branding, the `mae®` logo and the identical official Re.WIND artwork, but **no MAE GLOBAL SDN BHD registration statement anywhere**. Corporate ownership is a strong inference, not documented. Confirm with MAE.

**A former official iReason before/after section has been deliberately removed.** The archived iReason page had "THE COMPREHENSIVE SOLUTIONS FOR EYE PROBLEMS" with six Before/After pairs at `/images/eye/ireason/beforeafter/eye1..6.png`. All six 404 live **and** in the Wayback Machine — the HTML was archived, the images weren't, so the content is unrecoverable. That MAE took it down is itself a signal about its current appetite for eye-health result claims.

**No weight-loss before/after exists anywhere for BCODE+ or Total DX+.** Searched in English, Chinese (瘦身 / 减重 / 见证 / 前后对比) and Malay (sebelum selepas kurus). Zero body-transformation imagery from any source. Given how central weight is to BCODE+'s pitch, that absence looks deliberate — and it lines up with §5.5's finding that the live BCODE+ page has been scrubbed of kilo figures.

**The real risk is the agent layer, and it is worse than it first looks.** MAE's Hong Kong general agent (`hildachung.shop`, self-described Mae香港官方總代理) runs a 真實好評見證區 section containing before/after collages with **fully identifiable frontal faces**, built on MAE-styled templates and **stamped with the `mae®` logo**. One "Customer Review" grid quotes **"RECOVER UP TO 98%"**, "90%" and "99%". Separately, **MAE's own official Xiaohongshu account** posts customer-result content with full, unobscured faces — one cover badged 真实顾客反馈 ("real customer feedback").

### Recommendation
1. **Do not auto-import any before/after.** Not into the manifest, not into the assistant's send-able set.
2. If the user wants before/after at all, use **only** the 8 `maerewind.com` files and/or the corporate Re.WIND grid — anonymised by camera angle, brand-templated, MAE-published — and only after confirming `maerewind.com` ownership with MAE.
3. **Never reuse the agent-layer collages.** Three separate problems compound: (a) identifiable faces with no documented model release (personality rights + PDPA); (b) the `mae®` logo on agent-built templates makes unapproved material *look* brand-approved, so reusing it launders an agent's claim into MAE's voice; (c) the quantified claims ("RECOVER UP TO 98%", "100%有效絕不反彈") are agent-authored, not corporate, and are exactly the kind of efficacy figure Malaysian advertising rules treat harshly. The expiring CDN URLs make them technically unusable anyway.
4. Whatever is used, attach MAE's own disclaimer verbatim (§5.2) rather than an invented one.

---

## 10. Two corrections to the existing research notes

Worth propagating back into `MAE_RESEARCH.md`:

1. **The patented-ingredient lists were mixed up between lines.** `MAE_RESEARCH.md` lists Slendesta, FloraGLO, Lutemax 2020, Pomanox, Bilberon, Sirtmax and Aquamin-F in a way that reads as BCODE+ ingredients. **They are not in BCODE+.** BCODE+'s thirteen are the ones in §5.1; the six trademarked actives (Pomanox®, Bilberon®, Sirtmax®, FloraGLO®, Lutemax 2020, Aquamin-F®) belong to **iReason**. And `GARXLIM™` and `SUPERFINOL™`, both genuinely in BCODE+, were missing entirely.
2. **The iReason lutein dose is inconsistent between sources.** `MAE_RESEARCH.md` records "25.8 mg lutein + 5.16 mg zeaxanthin" per sachet. MAE's own archived iReason page states **"Lutein > 10mg, Zeaxanthin > 2mg"** with the same 5:1 golden ratio. Both cannot be right. Do not let the assistant quote a specific milligram figure until MAE confirms which is current — an overstated dose on a supplement is a real compliance problem.

Also flag: **MAE has quietly removed two disease claims** from its live site that survive only in archived pages — Total DX+ once listed *"Improves Chronic & Major Diseases"* and Total EM+ *"Prevents Diabetes"*, plus a claim that beetroot may "help suppress the development of some types of cancer". These must never be resurrected, and their removal is a useful signal that MAE itself has tightened its compliance posture.
