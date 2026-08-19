/**
 * The message an admin sends a newly approved agent, in English and Chinese.
 *
 * Generated from the approval result rather than retyped, because credentials
 * copied by hand are how a rollout produces "it says wrong password" on day one.
 *
 * On the early-version note: it says we are giving it to our own team first,
 * ahead of everyone else, and asks for ideas. That is the same fact as "expect
 * bugs", told as access rather than apology, and it makes a reply feel like
 * contributing rather than complaining.
 */
export function welcomeMessage(opts: {
  name: string;
  email: string;
  passcode: string;
  origin: string;
}): string {
  const first = opts.name.split(" ")[0];
  const { email, passcode, origin } = opts;

  return `Hi ${first}, your GC account is ready.

GC is your own AI seller. It answers your customers on WhatsApp in your name, in their language, around the clock.

Sign in: ${origin}
Email: ${email}
Passcode: ${passcode}  (the last 6 digits of your phone number)

A short tour opens when you sign in. Please go through all of it, then do these three:
1. Set up GC, and fill in your bank name, account holder name and account number
2. Connect, and link your WhatsApp Business
3. On the Connect page press "Run the full check". All green means you are live.

We are giving this to our own team first, ahead of everyone else, so you are getting it while we are still shaping it. If something looks off, or you have an idea, WhatsApp me directly and it goes into the next update.

- - - - - - - - - -

${first} 你好，你的 GC 账号已经开通了。

GC 是你自己的 AI 销售助理。它用你的名义，在 WhatsApp 上用客户的语言，24 小时帮你回复客户。

登录网址：${origin}
邮箱：${email}
密码：${passcode}（你手机号码的最后 6 位）

登录后会有一个简短的导览，请全部走一遍，然后完成这三步：
1. Set up GC：填写你的银行名称、户口持有人姓名和账号
2. Connect：连接你的 WhatsApp Business
3. 在 Connect 页面点 "Run the full check"，全部显示绿色就代表可以开工了。

我们先让自己的团队用，比外面早一步，所以你拿到的是我们还在打磨中的版本。如果你觉得哪里怪怪的，或者有什么想法，直接 WhatsApp 我，你的反馈会直接进下一个更新。`;
}

/** Local 0-prefixed numbers are Malaysian here; anything else is left as typed. */
export function waNumber(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  return digits.startsWith("0") ? "60" + digits.slice(1) : digits;
}
