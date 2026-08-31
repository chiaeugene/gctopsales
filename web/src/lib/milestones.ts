/**
 * The moments worth celebrating during a rollout.
 *
 * Deliberately derived from live data rather than stored, so nothing has to be
 * awarded, nothing can be awarded twice, and every milestone is retroactively
 * true for people who reached it before this existed.
 *
 * Chosen for what they mean rather than what is easy to count: the first real
 * customer answered matters enormously and the fiftieth does not, so the ladder
 * gets steeper as it goes and stops before it becomes noise.
 */
export type Milestone = {
  key: string;
  /** Said to the agent, second person, present tense. */
  title: string;
  detail: string;
  /** Said about the agent, for the admin's feed. */
  adminLine: string;
  reached: boolean;
};

export type MilestoneInput = {
  name: string;
  trainingCount: number;
  practiceReplies: number;
  paymentReady: boolean;
  whatsappConnected: boolean;
  liveReplies: number;
  paidOrders: number;
};

export function milestonesFor(a: MilestoneInput): Milestone[] {
  const first = a.name.split(" ")[0];
  return [
    {
      key: "trained",
      title: "You taught GC your first reply",
      detail: "It now sells a little more like you, in every chat, from here on.",
      adminLine: `${first} taught GC their first reply`,
      reached: a.trainingCount > 0,
    },
    {
      key: "practised",
      title: "You ran your first practice chat",
      detail: "That was the real engine, the same one your customers get.",
      adminLine: `${first} ran their first practice chat`,
      reached: a.practiceReplies > 0,
    },
    {
      key: "payment",
      title: "You can take money now",
      detail: "GC closes the sale on its own: it sends your bank details the moment somebody says yes.",
      adminLine: `${first} added their bank details`,
      reached: a.paymentReady,
    },
    {
      key: "connected",
      title: "WhatsApp is connected",
      detail: "The biggest step there is. Your number and GC are joined up.",
      adminLine: `${first} connected WhatsApp`,
      reached: a.whatsappConnected,
    },
    {
      key: "firstCustomer",
      title: "GC answered a real customer",
      detail: "Somebody messaged you and got an answer without you touching your phone. That is the whole idea.",
      adminLine: `${first} had their FIRST real customer answered`,
      reached: a.liveReplies > 0,
    },
    {
      key: "tenCustomers",
      title: "Ten real replies",
      detail: "GC is carrying real conversations for you now, not just proving it can.",
      adminLine: `${first} passed 10 real replies`,
      reached: a.liveReplies >= 10,
    },
    {
      key: "hundred",
      title: "A hundred real replies",
      detail: "That is a hundred customers who did not wait. Some of them bought because of it.",
      adminLine: `${first} passed 100 real replies`,
      reached: a.liveReplies >= 100,
    },
    {
      key: "firstSale",
      title: "Your first paid order through GC",
      detail: "Money in, from a conversation you did not have to be awake for.",
      adminLine: `${first} took their FIRST paid order through GC`,
      reached: a.paidOrders > 0,
    },
  ];
}

/** The one to shout about: furthest reached, so the newest achievement wins. */
export function latestMilestone(a: MilestoneInput): Milestone | null {
  const reached = milestonesFor(a).filter((m) => m.reached);
  return reached.length ? reached[reached.length - 1] : null;
}
