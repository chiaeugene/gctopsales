// Starter discovery menus for MAE agents — the "which of these is you?"
// opening that top sellers use instead of a vague "how can I help?".
//
// Each one is built from a real MAE problem area (the same problem → product
// mapping in research/MAE_RESEARCH.md), so a customer's answer lands GC
// directly on the right line without a guessing round.
//
// Deliberately 3 options each: enough to cover the common cases, few enough
// that a customer answers with one character instead of going quiet.

export type MenuSeed = {
  topic: string;
  question: string;
  options: string[];
  followUpNote: string;
};

export const DISCOVERY_MENU_SEEDS: MenuSeed[] = [
  {
    topic: "Skin",
    question: "Which one bothers you most about your skin right now?",
    options: ["Big pores & oily", "Dark spots / uneven tone", "Dull and tired-looking"],
    followUpNote:
      "Pores/oily → Claríty deep-cleanse mask. Dark spots → Claríty Anti-Aging GLO2 (alpha-arbutin). Dull → REP1 then GLO2. If they mention acne, B-SynN also helps from inside (cellular level), so a mask + inner combo is the natural pairing.",
  },
  {
    topic: "Gut & digestion",
    question: "Which sounds most like your tummy?",
    options: ["Bloated after meals", "Not going to the toilet regularly", "Always feels heavy / sluggish"],
    followUpNote:
      "Bloated after meals → Total DX+ digestive detox. Irregular → B-SynN at night (6 billion CFU) plus B-OriG in the morning as the synbiotic pair. Heavy/sluggish → the night stack, DX+ with B-SynN one hour before bed.",
  },
  {
    topic: "Weight & body",
    question: "What's the hardest part for you?",
    options: ["I eat too much / can't control portions", "Water retention & puffiness", "Metabolism feels slow"],
    followUpNote:
      "Portions → B-ActV 15-30 min before meals (natural GLP-1 satiety, not a drug). Water retention → B-VtrA with its Cactinea prickly pear. Slow metabolism → the BCODE+ programme ladder, start at the 7-Day Metabolic Kickstart for skeptics.",
  },
  {
    topic: "Hair & scalp",
    question: "Which is your main hair worry?",
    options: ["Hair falling / thinning", "Oily scalp & dandruff", "Dry, damaged, frizzy"],
    followUpNote:
      "Falling → Re.WIND Hair Re-active Essence, morning and night. Oily/dandruff → Scalp Balancing Shampoo with a double cleanse. Dry/damaged → Super Hydrating Shampoo plus Glow Hair Mask. Best results come from the full 4-step ritual, so mention it once they pick.",
  },
  {
    topic: "Sleep & stress",
    question: "Which one is affecting you more?",
    options: ["Can't switch off at night", "Stressed and on edge all day", "Tired even after sleeping"],
    followUpNote:
      "Can't switch off → BRB 30 min before bed. Stressed → BRB plus the Roll On for during the day. Tired despite sleeping → ask about gut and energy too, this is often DX+ or B-OriG territory rather than BRB alone.",
  },
  {
    topic: "Eyes",
    question: "How do your eyes feel by the end of the day?",
    options: ["Dry and strained from screens", "Blurry / hard to focus", "Tired and heavy"],
    followUpNote:
      "All three point to iReason. Ask how many hours a day they're on screens, the number itself makes the case for them. Start at the 2-box trial for skeptics, B3F1 for someone committed.",
  },
];
