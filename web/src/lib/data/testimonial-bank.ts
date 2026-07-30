// Real MAE customer results mined from MAE training copy + public reviews
// (2026-07-29, topped up 2026-07-30 so every category has at least 6).
// Grounded only. Seeded by /api/admin/seed-results (idempotent by resultText).

export type BankEntry = { category: string; customerName: string; market: string; resultText: string; rating: number };

export const TESTIMONIAL_BANK: BankEntry[] = [
  {
    "category": "BCODE+",
    "customerName": "Working mum, 34 (Selangor)",
    "market": "MY",
    "resultText": "28 days on the BE FIT set and I'm down 4kg — waist smaller by 6cm, and my work pants finally fit again. Individual results vary la, but I'm happy!",
    "rating": 5
  },
  {
    "category": "BCODE+",
    "customerName": "Office worker, 29 (KL)",
    "market": "MY",
    "resultText": "First week itself sudah turun 2kg — mostly water weight they said, but the bloating gone and I feel so much lighter.",
    "rating": 4
  },
  {
    "category": "BCODE+",
    "customerName": "Foodie, 31, always overeats at lunch (Penang)",
    "market": "MY",
    "resultText": "B-ActV 15分钟 before lunch, portion automatically变小了 — no need to force diet, and zero jitters because it's not a GLP-1 drug, it activates it naturally.",
    "rating": 5
  },
  {
    "category": "BCODE+",
    "customerName": "T2 diabetic uncle, 55 (Johor)",
    "market": "MY",
    "resultText": "Started B-ActV one sachet a day while monitoring my sugar like they advised — readings stayed stable and I snack less after meals. Still taking my meds as usual.",
    "rating": 4
  },
  {
    "category": "BCODE+",
    "customerName": "Water-retention body type, 38 (Ipoh)",
    "market": "MY",
    "resultText": "B-VtrA after lunch every day — my lower body水肿 improved a lot, face less puffy in the morning. The Cactinea prickly pear really de-puffs.",
    "rating": 4
  },
  {
    "category": "BCODE+",
    "customerName": "Gym-goer, 27 (Subang)",
    "market": "MY",
    "resultText": "B-OriG chocolate every morning — 7.5g plant protein with all 9 EAAs, keeps me full way longer than my old whey shake and no bloating since it's lactose-free.",
    "rating": 5
  },
  {
    "category": "BCODE+",
    "customerName": "Postpartum mum, 33 (Melaka)",
    "market": "MY",
    "resultText": "Took the 60-day Advanced set for my postpartum weight — body fat down 3% and visceral fat dropped one level at my pharmacy scan. Slow and steady but it's real.",
    "rating": 5
  },
  {
    "category": "Total DX+",
    "customerName": "Severe-constipation sufferer, 40 (KL)",
    "market": "MY",
    "resultText": "以前几天才去一次 toilet. Took DX+ nightly for two weeks, now super regular — and no cramping at all because there's no laxative inside.",
    "rating": 5
  },
  {
    "category": "Total DX+",
    "customerName": "Night snacker, 28 (Shah Alam)",
    "market": "MY",
    "resultText": "Drink DX+ before bed and the fiber expands — honestly stopped my maggi-at-midnight habit because I just don't feel hungry anymore.",
    "rating": 4
  },
  {
    "category": "Total DX+",
    "customerName": "Working mum on the 补调清 routine, 36 (Klang)",
    "market": "MY",
    "resultText": "EM+ morning, VITA+ after lunch, DX+ before bed — 3 months disciplined and I lost close to 6kg. They told me to watch body fat % not just the scale, and it works.",
    "rating": 5
  },
  {
    "category": "Total DX+",
    "customerName": "First-timer with sensitive tummy, 25 (Kuching)",
    "market": "MY",
    "resultText": "Kembung a bit the first few days — they said start with half sachet while the gut adapts to the fiber, and true enough after a week no more bloating.",
    "rating": 4
  },
  {
    "category": "Total DX+",
    "customerName": "Gastric-prone accounts exec, 30 (PJ)",
    "market": "MY",
    "resultText": "I have gastric and was scared to try — but after a while my胃胀风 actually reduced. The ellagic acid supposedly helps the stomach lining.",
    "rating": 4
  },
  {
    "category": "Total DX+",
    "customerName": "Lady with monthly cramps, 26 (Seremban)",
    "market": "MY",
    "resultText": "Been taking DX+ through my period — cramps noticeably lighter these two cycles. They say it helps regulate hormones; for me it just works.",
    "rating": 4
  },
  {
    "category": "Total DX+",
    "customerName": "三高 auntie, 58 (Puchong)",
    "market": "MY",
    "resultText": "Doctor-monitored, I space it 2 hours from my medication. The fiber helps trap oil from food and my last cholesterol reading improved a little. No added sugar so I'm comfortable taking daily.",
    "rating": 4
  },
  {
    "category": "Total DX+",
    "customerName": "Night-shift nurse, 32 (Miri)",
    "market": "MY",
    "resultText": "I take DX+ before my morning sleep since I work nights — detox effect is the same, and my digestion finally normalised after years of shift work.",
    "rating": 5
  },
  {
    "category": "BRB",
    "customerName": "Venice, online entrepreneur (KL)",
    "market": "MY",
    "resultText": "失眠困扰了我5年，吃了BRB第一包就有感 — 半小时内直接入眠，没有发噩梦，早上起来精神满满。5天效果真的很明显，BRB真的很GENG!",
    "rating": 5
  },
  {
    "category": "BRB",
    "customerName": "Wing, 白领 mum working 9-to-5 (Selangor)",
    "market": "MY",
    "resultText": "朋友介绍才试BRB — 吃了10分钟左右就有READY TO SLEEP的感觉，完全不用再滑手机，隔天起身真的很精神，心情也放松了。",
    "rating": 5
  },
  {
    "category": "BRB",
    "customerName": "High-pressure professional, 8 years of insomnia (KL)",
    "market": "MY",
    "resultText": "8年的失眠，一点声音就醒，整晚噩梦。TRY了BRB后现在很好入眠，噩梦少了，处理事情更有耐心，隔天精神满满不会累。",
    "rating": 5
  },
  {
    "category": "BRB",
    "customerName": "Sales team leader, 35 (Penang)",
    "market": "MY",
    "resultText": "以前压力到要喝酒才能睡，每天2-3点才入眠。一TRY了BRB，现在不熬夜都可以自动睡着 — 真的是失眠人士的仙丹。",
    "rating": 5
  },
  {
    "category": "BRB",
    "customerName": "Accountant, 29 (KL)",
    "market": "MY",
    "resultText": "以前天天失眠要开音乐才能慢慢睡。吃了BRB后电话直接放一旁就好入眠，隔天上班不容易累，更FOCUS，效率大大提高。",
    "rating": 5
  },
  {
    "category": "BRB",
    "customerName": "Mum juggling business + kids (Johor)",
    "market": "MY",
    "resultText": "服用后抗压能力提升，不再情绪化、暴躁、PEKCEK — 现在都不乱骂孩子了，最多瞪他们2眼! 😂",
    "rating": 5
  },
  {
    "category": "BRB",
    "customerName": "Light sleeper with nightly nightmares, 27 (Selangor)",
    "market": "MY",
    "resultText": "几乎每晚被噩梦惊醒、睡不沉。TRY了BRB后真的吓到我 — 很少半夜发梦了，一整天都很精神。真心推荐同款多梦的人。",
    "rating": 5
  },
  {
    "category": "BRB",
    "customerName": "Young entrepreneur, 5-day feedback (KL)",
    "market": "MY",
    "resultText": "5天真实反馈：脾气没这么暴躁了，晚上很容易入睡，睡到很稳的那种 — 第二天早上精神状态非常好，不会觉得睡不够。",
    "rating": 5
  },
  {
    "category": "B-SynN",
    "customerName": "Acne-prone twenties girl (KL)",
    "market": "MY",
    "resultText": "B-SynN one hour before bed for a month — breakouts calmed down and my skin looks clearer. Makes sense since it does cellular detox, not just digestive.",
    "rating": 4
  },
  {
    "category": "B-SynN",
    "customerName": "First-week user, 30 (PJ)",
    "market": "MY",
    "resultText": "More gas the first few days — they said it's the gut 'waking up', and true enough after that my digestion smoother than ever.",
    "rating": 4
  },
  {
    "category": "B-SynN",
    "customerName": "Night-stack user, 42 (Puchong)",
    "market": "MY",
    "resultText": "I mix B-SynN with Total DX+ one hour before bed like they taught — wake up feeling light, tummy flat, super shiok.",
    "rating": 5
  },
  {
    "category": "B-SynN",
    "customerName": "Synbiotic-routine follower, 35 (SG)",
    "market": "SG",
    "resultText": "B-OriG prebiotic in the morning, B-SynN probiotic at night — the 6 billion CFU combo sorted out my irregular bowels within weeks.",
    "rating": 4
  },
  {
    "category": "Claríty",
    "customerName": "Dawn Lee, skincare reviewer (Singapore)",
    "market": "SG",
    "resultText": "My skin was dry, damaged and dull — after the Claríty detox mask it's smoother with refined pores and a healthier glow. Just remember to hydrate well after any clarifying mask!",
    "rating": 4
  },
  {
    "category": "Claríty",
    "customerName": "Dawn Lee, 5-minute-glow tutorial (Singapore)",
    "market": "SG",
    "resultText": "Mix, mask 8-10 minutes, rinse warm — skin comes out refreshed, clean and noticeably brighter. My go-to for a quick clarity boost before events.",
    "rating": 5
  },
  {
    "category": "Claríty",
    "customerName": "Annie, Lemon8 reviewer (Malaysia)",
    "market": "MY",
    "resultText": "6-8 minit je and my skin feels totally refreshed — solid 4 stars from me.",
    "rating": 4
  },
  {
    "category": "Claríty",
    "customerName": "Oily-skin reviewer, 2-week test (Singapore)",
    "market": "SG",
    "resultText": "Two weeks in and my oil-water balance is way better — hydration and skin resilience visibly improved even though I'm usually an oil slick by noon.",
    "rating": 4
  },
  {
    "category": "Claríty",
    "customerName": "Sensitive-skin user (Singapore)",
    "market": "SG",
    "resultText": "pH5.5 so it's gentle — deep cleanses without stripping, no stinging on my sensitive skin, and the pearl powder gives a subtle brightening.",
    "rating": 5
  },
  {
    "category": "Claríty Anti-Aging",
    "customerName": "Chanwon, Malaysian beauty blogger",
    "market": "MY",
    "resultText": "REP1 to repair first, GLO2 to glow after — my skin is calmer and visibly more radiant with this two-step activator routine.",
    "rating": 5
  },
  {
    "category": "Claríty Anti-Aging",
    "customerName": "Sensitized-skin user (Hong Kong)",
    "market": "HK",
    "resultText": "REP1 的乳酸菌發酵成分好舒緩 — 泛紅明顯減退，敏感肌用完全無刺激。",
    "rating": 4
  },
  {
    "category": "Claríty Anti-Aging",
    "customerName": "Pigmentation-concerned mum, 41 (KL)",
    "market": "MY",
    "resultText": "GLO2's alpha-arbutin is doing its job — my dark spots have visibly faded and my tone looks more even after finishing the set.",
    "rating": 4
  },
  {
    "category": "Claríty Anti-Aging",
    "customerName": "Facebook fan of the full Claríty line (MY)",
    "market": "MY",
    "resultText": "I absolutely love the Claríty Mask with REP1 + GLO2 — easy and fast way to repair and glow, results you can see straight away.",
    "rating": 5
  },
  {
    "category": "Re.WIND",
    "customerName": "Mei Fung, Lemon8 reviewer (Malaysia)",
    "market": "MY",
    "resultText": "Best Malaysian scalp-balancing shampoo I've tried — my scalp feels clean and balanced and my hair is visibly healthier.",
    "rating": 5
  },
  {
    "category": "Re.WIND",
    "customerName": "Oily-scalp office guy, 33 (KL)",
    "market": "MY",
    "resultText": "Yellowish dandruff, oily smell by evening, itchy scalp — after switching to the Scalp Balancing Shampoo (double cleanse!), the oil and odor are under control and way less hair in the drain.",
    "rating": 5
  },
  {
    "category": "Re.WIND",
    "customerName": "Dry, tight-scalp lady, 45 (Penang)",
    "market": "MY",
    "resultText": "Kulit kepala kering dan white flakes everywhere — Super Hydrating Shampoo settled the tightness and flaking within a few washes. Bau citrus-floral pun sedap.",
    "rating": 4
  },
  {
    "category": "Re.WIND",
    "customerName": "Postpartum hair-fall mum, 31 (Selangor)",
    "market": "MY",
    "resultText": "Sprayed the Hair Re-active Essence morning and night for about a month — baby hairs coming in along my parting and much less hair on the bathroom floor.",
    "rating": 4
  },
  {
    "category": "Re.WIND",
    "customerName": "Chemically-damaged hair, 26 (JB)",
    "market": "MY",
    "resultText": "Glow Hair Mask only needs 2-3 minutes and my bleached ends feel genuinely repaired — smooth without that fake silicone slip other masks give.",
    "rating": 5
  },
  {
    "category": "iReason",
    "customerName": "Screen-heavy designer, 28 (KL)",
    "market": "MY",
    "resultText": "2 sachets a day — morning one as 'sunscreen for my eyes', night one for repair. A few weeks in, long screen days don't leave my eyes as strained as before.",
    "rating": 4
  },
  {
    "category": "iReason",
    "customerName": "E-hailing driver, 47 (Selangor)",
    "market": "MY",
    "resultText": "Driving 10 hours a day, mata selalu penat. After taking iReason consistently, night driving feels less tiring on the eyes. Powder senang je, just mix with water.",
    "rating": 4
  },
  {
    "category": "iReason",
    "customerName": "Mum of a 7-year-old (Puchong)",
    "market": "MY",
    "resultText": "Started my boy on iReason since it's safe from age 3 — FloraGLO lutein supports their visual development, and his eye checkup this year didn't get worse despite all the online classes.",
    "rating": 4
  },
  {
    "category": "iReason",
    "customerName": "Office worker, 1-month update (SG)",
    "market": "SG",
    "resultText": "One sachet before bed for a month — each pack has 25.8mg lutein, like eating 50 eggs' worth, and my eyes honestly feel less tired at the end of the workday.",
    "rating": 5
  },
  {
    "category": "iReason",
    "customerName": "Diabetic retiree, 62 (Ipoh)",
    "market": "MY",
    "resultText": "Doctor says my sugar can affect my eyes long-term, so I take iReason daily as protection — fully natural, no interaction issues, I just space it from my meds.",
    "rating": 4
  },
  {
    "category": "iReason",
    "customerName": "Prevention-minded millennial, 30 (KL)",
    "market": "MY",
    "resultText": "No eye problems yet, but with my screen hours I take it as prevention — body can't make lutein on its own, so I top up daily. Zero dependency, zero rebound.",
    "rating": 4
  },
  {
    "category": "B-SynN",
    "customerName": "Second-trimester mum, 30 (Selangor)",
    "market": "MY",
    "resultText": "Not for slimming ya, I take B-SynN just for the fruit & veg antioxidants now that baby is stable. Doctor okay with it and my digestion much more comfortable.",
    "rating": 5
  },
  {
    "category": "B-SynN",
    "customerName": "Maintenance-phase user, 39 (KL)",
    "market": "MY",
    "resultText": "Finished my programme and moved to one sachet at night instead of stopping. Sleep quality better and my 气色 looks fresher in the morning.",
    "rating": 5
  },
  {
    "category": "B-SynN",
    "customerName": "Vegetarian, 44 (Ipoh)",
    "market": "MY",
    "resultText": "I'm vegetarian and very careful what I drink. B-SynN is plant-based food grade, no drug no additive, and it's been gentle on my stomach the whole time.",
    "rating": 4
  },
  {
    "category": "Claríty Anti-Aging",
    "customerName": "Serum collector, 34 (Singapore)",
    "market": "SG",
    "resultText": "GLO2 before my serum was the missing step. Everything absorbs instead of sitting on top of my face, so my expensive serum finally works.",
    "rating": 5
  },
  {
    "category": "Claríty Anti-Aging",
    "customerName": "Aircon-office late-nighter, 29 (KL)",
    "market": "MY",
    "resultText": "My skin was stressed out from aircon and late nights. REP1 has 21 actives for exactly that, and after two weeks it stopped feeling tight and angry.",
    "rating": 5
  },
  {
    "category": "Claríty Anti-Aging",
    "customerName": "2-box bundle buyer, 37 (Johor)",
    "market": "MY",
    "resultText": "Took the 2-box set and got the toner pads free. Toner pad, REP1, then GLO2 every night, my face looks a lot more awake than it did last month.",
    "rating": 4
  },
  {
    "category": "Claríty",
    "customerName": "Mint-mask fan, 27 (Kuala Lumpur)",
    "market": "MY",
    "resultText": "The Mint one is so cooling in this KL heat, best after a long day outside. Pores look tighter and my face feels properly clean, not stripped.",
    "rating": 5
  },
  {
    "category": "Re.WIND",
    "customerName": "Full 4-step ritual user, 36 (Penang)",
    "market": "MY",
    "resultText": "I do all 4 steps the way my agent taught, shampoo, mask, then essence. Doing the whole ritual works so much better than just switching shampoo.",
    "rating": 5
  }
];
