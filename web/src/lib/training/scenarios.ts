// Customer archetypes for training role-plays. The agent plays THEMSELVES
// (the seller); GC plays each of these MAE customer types so the agent can
// demonstrate how they'd handle it. Their replies are then synthesized into
// a styleProfile injected into the real sales prompt.

export type Scenario = {
  key: string;
  title: string;
  // Opening line GC (playing the customer) sends to kick off the role-play.
  opener: string;
  // What the agent is practising.
  focus: string;
};

export const SCENARIOS: Scenario[] = [
  {
    key: "price-first",
    title: "The price-first shopper",
    opener: "Total DX+ 多少钱?",
    focus: "Bringing a price-first customer into buying mode before quoting.",
  },
  {
    key: "bloating-gut",
    title: "The bloated & constipated",
    opener: "I always feel bloated and constipated, got anything can help ah?",
    focus: "Problem discovery → mechanism education → Total DX+ recommendation.",
  },
  {
    key: "weight-goal",
    title: "The weight-loss goal",
    opener: "我想瘦大概10kg，你们有什么产品?",
    focus: "Matching goal size honestly to the right BCODE+ programme.",
  },
  {
    key: "skeptic",
    title: "The skeptic",
    opener: "这些真的有效吗？会不会是骗人的?",
    focus: "Handling doubt with certifications, awards, and honest expectation-setting.",
  },
  {
    key: "shopee-cheaper",
    title: "The price-comparer",
    opener: "Shopee 卖比较便宜 leh, 为什么跟你买?",
    focus: "Authenticity guarantee + member benefits without trashing competitors.",
  },
  {
    key: "stress-sleep",
    title: "The stressed insomniac",
    opener: "最近压力好大，很难入睡，有帮助吗？",
    focus: "BRB recommendation + segment empathy (working mum / stressed pro).",
  },
  {
    key: "medical-worry",
    title: "The 3-high patient",
    opener: "我有高血压在吃药，可以吃你们的产品吗？",
    focus: "Approved safety answer + medication spacing + when to defer to a doctor.",
  },
  {
    key: "postpartum",
    title: "The new mum",
    opener: "我刚生完宝宝，还在喂奶，想瘦身可以吗？",
    focus: "Pregnancy/breastfeeding rules — the compliant, caring answer.",
  },
  {
    key: "hair-fall",
    title: "The hair-fall worrier",
    opener: "掉发很严重，你们的洗发水能生发吗？",
    focus: "Re.WIND honest scope (scalp vs genetic) without overpromising.",
  },
  {
    key: "gift-buyer",
    title: "The gift buyer",
    opener: "想买给我妈妈，她眼睛容易累，有什么推荐?",
    focus: "Buying for someone else → iReason, and closing a gift purchase.",
  },
  {
    key: "just-looking",
    title: "The browser",
    opener: "随便看看 😄",
    focus: "Warmly opening a conversation with a non-committal browser.",
  },
  {
    key: "ready-to-buy",
    title: "The ready buyer",
    opener: "OK 我要买 BRB 3盒，how to pay?",
    focus: "Clean close: confirm cart, collect address, send payment instructions.",
  },
];

export function getScenario(key: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.key === key);
}
