/**
 * The team update: real numbers from the log, plus the verification situation in
 * plain terms, plus what is being done about it. Generated rather than hand-typed
 * so it can be regenerated honestly every time instead of guessed at.
 */
export type Summary = {
  enrolled: number;
  signedIn: number;
  trained: number;
  whatsappConnected: number;
  answeringCustomers: number;
  totalLiveReplies: number;
  totalPracticeReplies: number;
  totalPaidOrders: number;
};

export function teamUpdateMessage(s: Summary): string {
  const stuck = Math.max(0, s.whatsappConnected - s.answeringCustomers);
  return `GC Top Sales — team update

${s.enrolled} of you have joined so far. ${s.signedIn} have signed in, ${s.trained} have trained GC in your own words, and ${s.whatsappConnected} have connected WhatsApp.

Together GC has answered ${s.totalLiveReplies} real customer message${s.totalLiveReplies === 1 ? "" : "s"}${s.totalPracticeReplies ? `, plus ${s.totalPracticeReplies} practice replies while people were testing it` : ""}.${s.totalPaidOrders ? ` ${s.totalPaidOrders} order${s.totalPaidOrders === 1 ? " has" : "s have"} already been paid through it.` : ""}

The situation: a WhatsApp number only works once the business behind it is verified by Meta. Several of you connected successfully, but Meta is not delivering messages yet because that verification has not gone through${stuck > 0 ? ` — this is affecting ${stuck} of you right now` : ""}.

What we are doing: rather than wait on individual verification for each of you, we are moving connected numbers onto our own already-verified business account. Your number stays the same and your customers see no difference — this is a backend fix, not something you need to redo. We are rolling it out person by person to make sure each one lands cleanly, starting today.

If your WhatsApp is connected but you are not seeing replies land with real customers yet, that is this, not something wrong on your end. We will confirm with you directly once yours is switched over.

- - - - - - - - - -

GC Top Sales — 团队进度

目前已有 ${s.enrolled} 人加入。${s.signedIn} 人已登录，${s.trained} 人已经用自己的说法训练过 GC，${s.whatsappConnected} 人已连接 WhatsApp。

GC 目前已经回复了 ${s.totalLiveReplies} 条真实客户讯息${s.totalPracticeReplies ? `，另外在大家测试期间还回复了 ${s.totalPracticeReplies} 条练习讯息` : ""}。${s.totalPaidOrders ? `已经有 ${s.totalPaidOrders} 笔订单是透过它成交付款的。` : ""}

目前的情况：WhatsApp 号码需要该商业账户通过 Meta 的验证才能正常运作。有些人已经成功连接，但因为验证还没通过，Meta 暂时还没有开始投递讯息${stuck > 0 ? `，目前有 ${stuck} 位受影响` : ""}。

我们正在做的：与其让每个人各自等待验证，我们把已连接的号码转移到我们自己「已经通过验证」的商业账户底下。你的号码不会改变，客户那边也不会有任何差别 — 这是后台的调整，你不需要重新设置任何东西。我们会一个一个来，确保每一个都顺利过渡，今天就会开始。

如果你的 WhatsApp 已经连接，但还没看到真实客户的回复，那是因为这个原因，不是你那边的问题。等你的号码转移完成，我们会直接通知你。`;
}
