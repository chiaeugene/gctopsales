/**
 * The message an admin sends a newly approved agent, in English and Chinese.
 *
 * Generated from the approval result rather than retyped, because credentials
 * copied by hand are how a rollout produces "it says wrong password" on day one.
 *
 * The closing line asks for feedback WITHOUT pre-announcing faults. "Expect some
 * issues" costs confidence before anyone has opened the app, and a seller who
 * expects a tool to fail stops trusting it the first time anything is unfamiliar.
 * Being in the first group, and being the people who decide what gets built next,
 * gets the same replies and reads as standing instead of apology.
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

GC is your own AI seller. It answers your customers on WhatsApp in your name, in their language, around the clock, and it never quotes a price you did not set.

Sign in: ${origin}
Email: ${email}
Passcode: ${passcode}  (the last 6 digits of your phone number)

A guided tour opens when you sign in. Go through it, then three things:
1. Set up GC, and fill in your bank name, account holder name and account number
2. Connect, and link your WhatsApp Business
3. On the Connect page press "Run the full check". All green means you are live and GC is answering.

You are in the first group with GC. Tell me what you want it to do better and that is what we build next.

- - - - - - - - - -

${first} 你好，你的 GC 账号已经开通了。

GC 是你自己的 AI 销售助理。它用你的名义，在 WhatsApp 上用客户的语言，24 小时帮你回复客户，而且绝对不会报一个你没有设定的价格。

登录网址：${origin}
邮箱：${email}
密码：${passcode}（你手机号码的最后 6 位）

登录后会有一个导览，走一遍，然后完成这三步：
1. Set up GC：填写你的银行名称、户口持有人姓名和账号
2. Connect：连接你的 WhatsApp Business
3. 在 Connect 页面点 "Run the full check"，全部显示绿色就代表已经开通，GC 开始帮你回复了。

你是第一批用上 GC 的人。你想让它哪里做得更好，告诉我，我们接下来就做那个。`;
}

/** Local 0-prefixed numbers are Malaysian here; anything else is left as typed. */
export function waNumber(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  return digits.startsWith("0") ? "60" + digits.slice(1) : digits;
}
