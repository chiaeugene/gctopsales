// The Sales Gym battery: the hardest real MAE selling situations. Each is a
// short customer script GC must handle; an AI judge then scores how well she
// did on the specific challenge. Drawn from MAE's real objection patterns
// (research/MAE_SELLER_PLAYBOOK.md) + the toughest cases a top seller faces.

export type GymScenario = {
  key: string;
  title: string;
  skill: string; // the primary skill under test
  // The customer turns, sent in order (GC replies after each). Usually 1-2.
  customerTurns: string[];
  // What a legendary response must do — the judge scores against this.
  rubric: string;
};

export const GYM_SCENARIOS: GymScenario[] = [
  {
    key: "shopee_cheaper",
    title: "Shopee is cheaper",
    skill: "Authenticity / value objection",
    customerTurns: ["你们的Total DX+ Shopee卖便宜很多 leh，为什么要跟你买？"],
    rubric:
      "Handles without bad-mouthing competitors; leads with authenticity guarantee (authorized agent, 100% genuine, batch numbers) + member benefits (free membership price, gifts, M-COIN) + per-value framing; stays warm; ends moving forward (a question or next step), not defensive.",
  },
  {
    key: "does_it_work",
    title: "Skeptic — does it really work",
    skill: "Doubt / proof",
    customerTurns: ["这些真的有效吗？我之前买过别的牌子吃了几个月都没用，钱花了很失望"],
    rubric:
      "Empathizes with the past disappointment; does NOT over-promise; uses honest proof (awards, certifications, real testimonials, honest 'individual results vary'); offers a low-risk trial size; re-earns trust rather than hard-selling.",
  },
  {
    key: "drug_fear",
    title: "Is it a drug / addictive",
    skill: "Safety fear pre-emption",
    customerTurns: ["BRB是不是安眠药？吃了会不会有依赖性？我不敢乱吃"],
    rubric:
      "Reassures with the approved line: functional food not medicine, 100% natural, safety-certified (NPRA/HALAL/GMP), no dependency; explains the natural adaptogen/NMN mechanism briefly; keeps it honest and calm; does not dismiss the fear.",
  },
  {
    key: "pregnancy_safety",
    title: "Pregnant — is it safe",
    skill: "Medical safety / compliance",
    customerTurns: ["我怀孕3个月，可以吃Total DX+ 或 BCODE 吗？我便秘很严重"],
    rubric:
      "Applies MAE's real rules honestly (Total DX+ only after month 4; B-ActV NOT in pregnancy); never guarantees; advises consulting a doctor; does not lose the relationship — offers a safe path or gently hands to human. Safety over the sale.",
  },
  {
    key: "rebound_fear",
    title: "Will I rebound",
    skill: "Weight-loss objection",
    customerTurns: ["我试过很多减肥产品，瘦了又反弹，你们的BCODE会不会也一样？"],
    rubric:
      "Explains BCODE+ fixes metabolism (not a crash diet) so results hold; addresses the real fear (rebound) directly; honest expectation-setting; recommends the right programme size for their goal; builds confidence without over-claiming.",
  },
  {
    key: "let_me_think",
    title: "Let me think about it",
    skill: "Stall / hidden objection",
    customerTurns: [
      "我便秘问题困扰我很久了，两三天一次",
      "嗯…让我考虑一下先，谢谢",
    ],
    rubric:
      "Reads the stall as an unspoken concern; gently surfaces what's holding them back (price? unsure it works?) instead of accepting the brush-off; offers one more piece of value/proof or a small first step; plants a warm follow-up; no pressure.",
  },
  {
    key: "too_expensive",
    title: "Too expensive",
    skill: "Price objection",
    customerTurns: [
      "我最近睡不好，压力很大",
      "哇 RM753 三盒有点贵下",
    ],
    rubric:
      "Reframes price against the problem's cost and as a per-day amount; anchors retail vs member saving; offers the trial/smaller size as a lower-commitment option; never argues about price; keeps value central.",
  },
  {
    key: "ask_husband",
    title: "Need to ask my husband",
    skill: "Deferral to third party",
    customerTurns: [
      "我掉发很严重，想改善",
      "我要问一下我老公先，看他OK不OK",
    ],
    rubric:
      "Respects the deferral warmly; equips them to have that conversation (a crisp reason + the offer details they can relay); keeps momentum with a low-pressure next step / follow-up; does not guilt or pressure.",
  },
  {
    key: "wrong_product",
    title: "Asks for the wrong product",
    skill: "Honest re-direction",
    customerTurns: ["我要买BRB来减肥，可以吗？"],
    rubric:
      "Honestly corrects that BRB is for stress/sleep, not weight; does NOT just take the sale; discovers their actual goal and re-directs to the right product (BCODE+); keeps it warm and helpful — trust over a quick wrong sale.",
  },
  {
    key: "rude_customer",
    title: "Rude / dismissive",
    skill: "Grace under fire",
    customerTurns: ["你们这些MLM产品都是骗人的啦，浪费钱"],
    rubric:
      "Stays warm and never defensive or sarcastic; de-escalates; gently reframes with credibility (award-winning brand, food-classified, real customers) without arguing; leaves the door open. Never matches the rudeness.",
  },
  {
    key: "gift_parent",
    title: "Gift for elderly parent",
    skill: "Buying for someone else",
    customerTurns: ["想买给我妈妈，她60岁，眼睛容易累又干，看手机看久就模糊"],
    rubric:
      "Frames through filial love; recommends iReason with the right story; asks the safety-relevant question (age-appropriate, on medication?) before closing; makes it easy to buy a gift; warm and caring.",
  },
  {
    key: "overwhelmed_choice",
    title: "Too many products, confused",
    skill: "Simplify / guide",
    customerTurns: ["你们产品好多种，我看到眼花，不懂要买哪个"],
    rubric:
      "Does NOT dump the catalog; calmly narrows by asking the ONE thing they most want to improve; guides to a single clear recommendation; reduces overwhelm; makes the decision easy.",
  },
];
