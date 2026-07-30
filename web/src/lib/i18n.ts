// Lightweight two-language UI dictionary (English / Simplified Chinese for the
// Malaysian-Chinese agent base). No i18n framework: one flat map with both
// languages side by side, a cookie ("gc-lang") for persistence, and a client
// context (see components/I18nProvider.tsx).
//
// Conventions:
// - Keys are dot-namespaced by page: "nav.dashboard", "train.title", …
// - Server components: `t(lang, "key")` after reading the cookie.
// - Client components: `const { t } = useT()` from I18nProvider.
// - Missing key → the key itself is rendered (fails loudly in dev, harmless).

export type Lang = "en" | "zh";

export const LANG_COOKIE = "gc-lang";

export function normalizeLang(value: string | undefined | null): Lang {
  return value === "zh" ? "zh" : "en";
}

type Entry = { en: string; zh: string };

const dict: Record<string, Entry> = {
  // --- App shell -----------------------------------------------------------
  "nav.group.sell": { en: "Sell", zh: "销售" },
  "nav.group.grow": { en: "Grow", zh: "增长" },
  "nav.group.train": { en: "Train", zh: "训练" },
  "nav.group.team": { en: "Team", zh: "团队" },
  "nav.group.setup": { en: "Setup", zh: "设置" },
  "nav.dashboard": { en: "Dashboard", zh: "总览" },
  "nav.orders": { en: "Orders", zh: "订单" },
  "nav.products": { en: "Products", zh: "产品" },
  "nav.workspace": { en: "GC Workspace", zh: "GC 工作台" },
  "nav.campaigns": { en: "Campaigns", zh: "营销活动" },
  "nav.templates": { en: "Templates", zh: "消息模板" },
  "nav.results": { en: "Results", zh: "客户见证" },
  "nav.setupGc": { en: "Set up GC", zh: "设置 GC" },
  "nav.trainGc": { en: "Train GC", zh: "训练 GC" },
  "nav.gym": { en: "Sales Gym", zh: "销售训练营" },
  "nav.leaderboard": { en: "Leaderboard", zh: "排行榜" },
  "nav.admin": { en: "Admin", zh: "管理员" },
  "nav.connect": { en: "Connect", zh: "连接渠道" },
  "nav.settings": { en: "Settings", zh: "设置" },
  "nav.signOut": { en: "Sign out", zh: "退出" },
  "nav.roleAdmin": { en: "Admin", zh: "管理员" },
  "nav.roleAgent": { en: "Agent", zh: "代理" },
  "nav.tagline": { en: "Sales team workspace", zh: "销售团队工作台" },

  // --- Onboarding checklist (dashboard) ------------------------------------
  "onboard.title": { en: "Get GC ready to sell for you", zh: "让 GC 准备好为你销售" },
  "onboard.subtitle": {
    en: "Finish these once and GC starts replying like you, with your payment details and your products.",
    zh: "完成这几步，GC 就会用你的风格、你的收款方式和你的产品来回复客户。",
  },
  "onboard.step.setup": { en: "Do the setup interview", zh: "完成设置访谈" },
  "onboard.step.setupHint": {
    en: "Tell GC your payment details, shipping rules and how you talk.",
    zh: "告诉 GC 你的收款资料、送货规则和说话风格。",
  },
  "onboard.step.train": { en: "Train GC with 5 replies", zh: "用 5 条回复训练 GC" },
  "onboard.step.trainHint": {
    en: "Role-play tough customers — GC learns to sell in YOUR voice.",
    zh: "和刁钻客户角色扮演，GC 学会用你的口吻卖货。",
  },
  "onboard.step.chat": { en: "Try your first customer chat", zh: "试用第一个客户对话" },
  "onboard.step.chatHint": {
    en: "Paste a real customer message into the Workspace and copy GC's reply back.",
    zh: "把真实客户消息贴进工作台，再把 GC 的回复复制给客户。",
  },
  "onboard.stepDone": { en: "Done", zh: "完成" },
  "onboard.progress": { en: "steps done", zh: "步已完成" },

  // --- Workspace -----------------------------------------------------------
  "ws.suggestFollowUp": { en: "Suggest follow-up", zh: "生成跟进消息" },
  "ws.suggesting": { en: "GC is drafting…", zh: "GC 草拟中…" },
  "ws.quietDays": { en: "d quiet", zh: "天没回复" },
  "ws.title": { en: "GC Workspace", zh: "GC 工作台" },
  "ws.subtitle": {
    en: "One chat per customer. Paste what they sent you — GC writes the reply — copy it back to WhatsApp / IG / Messenger.",
    zh: "每位客户一个对话。把客户发来的消息贴进来，GC 写好回复，你再复制回 WhatsApp / IG / Messenger。",
  },
  "ws.newChatName": { en: "New customer's name…", zh: "新客户名字…" },
  "ws.newChat": { en: "+ New customer chat", zh: "+ 新建客户对话" },
  "ws.creating": { en: "Creating…", zh: "创建中…" },
  "ws.noChats": { en: "No chats yet. Start one per customer you're talking to.", zh: "还没有对话。为每位在聊的客户开一个。" },
  "ws.unnamed": { en: "Unnamed customer", zh: "未命名客户" },
  "ws.pickChat": { en: "Pick or start a chat", zh: "选择或新建对话" },
  "ws.chats": { en: "Chats", zh: "对话" },
  "ws.customerChats": { en: "Customer chats", zh: "客户对话" },
  "ws.close": { en: "Close", zh: "关闭" },
  "ws.rename": { en: "Rename", zh: "改名" },
  "ws.delete": { en: "Delete", zh: "删除" },
  "ws.startHint": {
    en: "Start a chat for each customer you're talking to. GC remembers every chat separately.",
    zh: "为每位在聊的客户开一个对话，GC 会分开记住每个对话。",
  },
  "ws.startChat": { en: "Start a customer chat", zh: "新建客户对话" },
  "ws.firstMessageHint": {
    en: "Paste the customer's first message below — exactly as they sent it, any language.",
    zh: "把客户的第一条消息原样贴在下面，任何语言都可以。",
  },
  "ws.typing": { en: "GC is typing…", zh: "GC 输入中…" },
  "ws.pasteMessage": { en: "Paste the customer's message…", zh: "贴上客户的消息…" },
  "ws.send": { en: "Send", zh: "发送" },
  "ws.copyReply": { en: "Copy reply", zh: "复制回复" },
  "ws.copied": { en: "Copied — paste to customer", zh: "已复制，去贴给客户吧" },
  "ws.orderState": { en: "Live order state", zh: "实时订单状态" },
  "ws.orderStateHint": { en: "Updates as GC works the sale — status, cart, payment.", zh: "GC 推进销售时实时更新：状态、购物车、付款。" },

  // --- Train GC page --------------------------------------------------------
  "train.title": { en: "Train GC", zh: "训练 GC" },
  "train.subtitle": {
    en: "You play the seller; GC plays your toughest customers. Every reply you type is saved and GC starts selling in YOUR voice.",
    zh: "你来当卖家，GC 扮演最难搞的客户。你打的每一条回复都会被记住，GC 会开始用你的口吻卖货。",
  },
  "train.refreshStyle": { en: "Refresh my style", zh: "刷新我的风格" },
  "train.repliesLearned": { en: "replies learned", zh: "条回复已学会" },
  "train.statusHint": {
    en: "GC re-reads your latest replies before every real customer message. The more you train, the more she sounds like you.",
    zh: "每次回复真实客户之前，GC 都会重温你最新的回复。练得越多，她就越像你。",
  },
  "train.styleHeading": { en: "GC's current impression of your style:", zh: "GC 目前对你风格的印象：" },
  "train.notEnough": {
    en: "Not enough of your replies yet — role-play a few more scenarios first.",
    zh: "你的回复还不够多，先多玩几个场景吧。",
  },
  "train.pickScenario": {
    en: "Pick a customer type to start role-playing. Reply the way YOU would sell.",
    zh: "选一种客户类型开始角色扮演，用你平时卖货的方式回复。",
  },
  "train.youAreSeller": { en: "you are the seller", zh: "你是卖家" },
  "train.customerLabel": { en: "Customer (GC)", zh: "客户（GC 扮演）" },
  "train.learnedReply": { en: "GC learned this reply", zh: "GC 学会了这条回复" },
  "train.customerTyping": { en: "Customer is typing…", zh: "客户输入中…" },
  "train.inputPlaceholder": { en: "Reply as the seller (your own words)…", zh: "用你自己的话回复客户…" },
  "train.send": { en: "Send", zh: "发送" },

  // --- Setup interview page -------------------------------------------------
  "setup.title": { en: "Set up GC", zh: "设置 GC" },
  "setup.subtitle": {
    en: "A short interview — everything you answer here is written straight into GC's brain and used in every customer reply.",
    zh: "一个简短的访谈。你在这里的每个回答都会直接写进 GC 的大脑，用在每一条客户回复里。",
  },
  "setup.learnsTitle": { en: "What GC learns from this chat:", zh: "GC 会从这段对话学到：" },
  "setup.learn.tone": {
    en: "How you talk to customers (your tone and language mix)",
    zh: "你和客户聊天的方式（语气和语言习惯）",
  },
  "setup.learn.payment": {
    en: "Your payment details — bank, account name/number (GC uses these to verify payment screenshots)",
    zh: "你的收款资料：银行、户口名和号码（GC 用来核对付款截图）",
  },
  "setup.learn.shipping": { en: "Your shipping, COD, and discount rules", zh: "你的送货、COD 和折扣规则" },
  "setup.learn.customers": { en: "Who your typical customers are", zh: "你的客户通常是哪些人" },
  "setup.learnsFootnote": {
    en: "Answer casually, like texting a friend. You can fine-tune everything later in Settings.",
    zh: "随意回答就好，就像和朋友聊天。之后都可以在设置里慢慢调整。",
  },
  "setup.done.prefix": {
    en: "Setup complete — GC is configured. You can refine anything in ",
    zh: "设置完成，GC 已经配置好。想调整的话可以去",
  },
  "setup.done.settings": { en: "Settings", zh: "设置" },
  "setup.done.or": { en: ", or ", zh: "，或者" },
  "setup.done.test": { en: "test GC now", zh: "现在就测试 GC" },
  "setup.done.suffix": { en: ".", zh: "。" },
  "setup.startBtn": { en: "Start setup interview", zh: "开始设置访谈" },
  "setup.starting": { en: "Starting…", zh: "开始中…" },
  "setup.typing": { en: "GC is typing…", zh: "GC 输入中…" },
  "setup.inputPlaceholder": { en: "Type your answer…", zh: "输入你的回答…" },
  "setup.send": { en: "Send", zh: "发送" },

  // --- Settings page --------------------------------------------------------
  "settings.title": { en: "Settings", zh: "设置" },
  "settings.subtitle": {
    en: "Everything here feeds GC's brain directly — plain answers are fine, she understands normal language.",
    zh: "这里的每一项都会直接进入 GC 的大脑。用平常的话写就行，她听得懂。",
  },
  "settings.loading": { en: "Loading…", zh: "加载中…" },
  "settings.loadFailed": { en: "Failed to load settings", zh: "设置加载失败" },
  "settings.saveFailed": { en: "Save failed", zh: "保存失败" },
  "settings.save": { en: "Save", zh: "保存" },
  "settings.saved": { en: "Saved", zh: "已保存" },
  "settings.important": { en: "Important", zh: "重要" },
  "settings.filled": { en: "filled", zh: "已填" },
  "settings.eg": { en: "e.g.", zh: "例如" },

  // Markets card
  "settings.markets.title": { en: "Countries you sell to", zh: "你销售的国家" },
  "settings.markets.desc": {
    en: "GC quotes the right currency and shipping per customer. When you serve more than one country, she confirms where the customer is before quoting a price.",
    zh: "GC 会按客户所在地报对货币和运费。如果你做多个国家，她会先确认客户在哪里才报价。",
  },
  "settings.markets.home": { en: "Home market (your default currency)", zh: "主要市场（你的默认货币）" },
  "settings.market.MY": { en: "Malaysia (RM)", zh: "马来西亚 (RM)" },
  "settings.market.SG": { en: "Singapore (S$)", zh: "新加坡 (S$)" },
  "settings.market.BN": { en: "Brunei (RM store)", zh: "汶莱（RM 店）" },

  // Tone card
  "settings.tone.title": { en: "GC's tone of voice", zh: "GC 的说话语气" },
  "settings.tone.desc": {
    en: "GC always replies in the customer's language (English / Mandarin / Malay) — this just sets how much local slang she uses.",
    zh: "GC 一定会用客户的语言回复（英文 / 中文 / 马来文），这里只是设定她用多少本地口语。",
  },
  "settings.tone.professional.label": { en: "Professional", zh: "专业" },
  "settings.tone.professional.desc": {
    en: "Polished & courteous — a knowledgeable consultant. Minimal slang.",
    zh: "得体有礼，像专业顾问，几乎不用俚语。",
  },
  "settings.tone.balanced.label": { en: "Balanced", zh: "均衡" },
  "settings.tone.balanced.desc": {
    en: "Warm and friendly with light local flavour where it fits. (Most agents pick this.)",
    zh: "亲切友好，偶尔带点本地味。（大多数代理选这个。）",
  },
  "settings.tone.local.label": { en: "Local", zh: "本地风" },
  "settings.tone.local.desc": {
    en: "Full local personality — Manglish / Singlish / Malay slang. Feels like a local friend.",
    zh: "十足本地个性：Manglish / Singlish / 马来俚语，像本地朋友在聊天。",
  },

  // Brain sections
  "settings.section.fulfillment.title": { en: "Payment & delivery", zh: "收款与配送" },
  "settings.section.fulfillment.why": {
    en: "The most important section — GC uses this to collect payment and check payment screenshots.",
    zh: "最重要的部分：GC 靠这里的资料收款和核对付款截图。",
  },
  "settings.section.identity.title": { en: "Your store & customers", zh: "你的店和客户" },
  "settings.section.identity.why": {
    en: "Helps GC introduce your store the way you would.",
    zh: "让 GC 像你一样介绍你的店。",
  },
  "settings.section.sales.title": { en: "How GC should sell", zh: "GC 该怎么卖" },
  "settings.section.sales.why": {
    en: "Your selling rules — what GC may promise, push, or never say.",
    zh: "你的销售规则：GC 可以承诺什么、推什么、绝不能说什么。",
  },
  "settings.section.catalog.title": { en: "Promos & product rules", zh: "促销与产品规则" },
  "settings.section.catalog.why": {
    en: "Keep the promo field fresh — GC actively pushes whatever you write here.",
    zh: "记得常更新促销栏，你写什么 GC 就会主动推什么。",
  },

  // Brain fields — fulfillment
  "settings.field.paymentMethods.label": { en: "Your payment methods", zh: "你的收款方式" },
  "settings.field.paymentMethods.help": {
    en: "Exact bank + account name + number. GC checks customer payment screenshots against THIS.",
    zh: "写清楚银行、户口名和号码。GC 就是用这个来核对客户的付款截图。",
  },
  "settings.field.paymentInstructions.label": {
    en: "What GC tells customers when it's time to pay",
    zh: "该付款时 GC 跟客户怎么说",
  },
  "settings.field.codRules.label": {
    en: "Cash on delivery — do you offer it? Where? Any conditions?",
    zh: "货到付款（COD）：有做吗？哪些地区？什么条件？",
  },
  "settings.field.shippingPolicy.label": { en: "How you ship", zh: "你怎么发货" },
  "settings.field.shippingFeeRules.label": { en: "Shipping fees", zh: "运费怎么算" },
  "settings.field.deliveryTimeline.label": { en: "How long delivery takes", zh: "送货要多久" },
  "settings.field.returnRefundPolicy.label": { en: "Returns & refunds", zh: "退换货与退款" },
  "settings.field.humanOnlyTopics.label": {
    en: "Topics GC must always pass to you",
    zh: "GC 必须交给你处理的话题",
  },
  "settings.field.humanOnlyTopics.help": {
    en: "GC freezes the chat and waits for you when these come up.",
    zh: "遇到这些话题，GC 会先暂停对话等你来接手。",
  },

  // Brain fields — identity
  "settings.field.storeName.label": { en: "Store name customers know you by", zh: "客户认识你的店名" },
  "settings.field.targetCustomer.label": { en: "Who usually buys from you", zh: "通常谁跟你买" },
  "settings.field.brandPersonality.label": { en: "Your store's personality", zh: "你店的个性" },
  "settings.field.toneOfVoice.label": { en: "How you talk to customers", zh: "你和客户说话的方式" },
  "settings.field.languageStyle.label": { en: "Languages you sell in", zh: "你用什么语言卖货" },
  "settings.field.differentiators.label": {
    en: "Why customers buy from YOU (not another agent)",
    zh: "客户为什么跟你买（而不是别的代理）",
  },
  "settings.field.offerings.label": { en: "What you sell (in one line)", zh: "你卖什么（一句话）" },

  // Brain fields — sales
  "settings.field.discountRules.label": { en: "Discounts GC is allowed to give", zh: "GC 可以给的折扣" },
  "settings.field.discountRules.help": {
    en: "GC follows this EXACTLY. Outside these rules, she hands the chat to you instead of discounting.",
    zh: "GC 会严格照做。超出这些规则她不会乱给折扣，而是把对话交给你。",
  },
  "settings.field.followUpRules.label": {
    en: "How you like to follow up silent customers",
    zh: "客户没回复时你怎么跟进",
  },
  "settings.field.objectionStyle.label": {
    en: "How you handle 'too expensive' / 'let me think'",
    zh: "客户说「太贵」「再考虑」时你怎么应对",
  },
  "settings.field.conversationStrategy.label": {
    en: "How you open and qualify a new lead",
    zh: "新客上门你怎么开场和了解需求",
  },
  "settings.field.upsellStrategy.label": { en: "When and what you upsell", zh: "什么时候加推、推什么" },
  "settings.field.allowedToSay.label": { en: "Things you WANT GC to say", zh: "你希望 GC 主动说的话" },
  "settings.field.neverSay.label": { en: "Things GC must NEVER say", zh: "GC 绝对不能说的话" },
  "settings.field.salesPressure.label": {
    en: "Sales pressure: soft / balanced / assertive",
    zh: "销售力度：soft（温和）/ balanced（均衡）/ assertive（积极）",
  },

  // Brain fields — catalog
  "settings.field.currentPromotions.label": { en: "THIS MONTH's promo", zh: "本月促销" },
  "settings.field.currentPromotions.help": {
    en: "Update monthly! GC brings this up at the right moment in every sale.",
    zh: "记得每个月更新！GC 会在每单销售的最佳时机提起。",
  },
  "settings.field.bundleRules.label": { en: "Bundles you offer", zh: "你的配套（bundle）" },
  "settings.field.membershipPitch.label": { en: "How you pitch membership pricing", zh: "你怎么介绍会员价" },
  "settings.field.loyaltyProgram.label": { en: "Loyalty / repeat-customer perks", zh: "老客户 / 回头客优惠" },
  "settings.field.authenticityGuarantee.label": {
    en: "How you prove products are genuine",
    zh: "你怎么证明产品是正货",
  },
  "settings.field.complianceRules.label": {
    en: "Extra claim rules for your market",
    zh: "你市场的额外宣称规则",
  },

  // Follow-up card
  "settings.followups.title": { en: "Automatic follow-ups", zh: "自动跟进" },
  "settings.followups.desc": {
    en: "GC nudges customers who went quiet. Keep the delay under 24h so messages still deliver on WhatsApp. Leave blank to turn follow-ups off.",
    zh: "客户安静了 GC 会轻轻提醒一下。间隔最好在 24 小时内，WhatsApp 消息才送得出去。留空就是关闭跟进。",
  },
  "settings.followups.after": { en: "Follow up after (hours)", zh: "多少小时后跟进" },
  "settings.followups.max": { en: "Max follow-ups", zh: "最多跟进次数" },

  // Channels card
  "settings.channels.title": { en: "Advanced: channel credentials", zh: "进阶：渠道凭证" },
  "settings.channels.desc": {
    en: "Technical setup for connecting WhatsApp/Messenger/Instagram directly. Most agents can ignore this — use the Connect page instead, or keep using GC Workspace with copy-paste.",
    zh: "直接连接 WhatsApp/Messenger/Instagram 的技术设置。大多数代理不用管这里，用连接页面就好，或者继续在 GC 工作台复制粘贴。",
  },
  "settings.channels.inactive": { en: "inactive", zh: "未启用" },
  "settings.channels.disconnect": { en: "Disconnect", zh: "断开" },
  "settings.channels.channel": { en: "Channel", zh: "渠道" },
  "settings.channels.idWhatsapp": { en: "Phone number ID", zh: "电话号码 ID" },
  "settings.channels.idMessenger": { en: "Facebook Page ID", zh: "Facebook 专页 ID" },
  "settings.channels.idInstagram": { en: "Instagram Business Account ID", zh: "Instagram 商业账号 ID" },
  "settings.channels.accessToken": {
    en: "Access token (kept server-side, never shown again)",
    zh: "Access token（只存在服务器，不会再显示）",
  },
  "settings.channels.displayName": { en: "Display name (optional)", zh: "显示名称（可选）" },
  "settings.channels.connecting": { en: "Connecting…", zh: "连接中…" },
  "settings.channels.connect": { en: "Connect channel", zh: "连接渠道" },
  "settings.channels.connectFailed": { en: "Failed to connect", zh: "连接失败" },

  // Auto-confirm card
  "settings.autoconfirm.title": {
    en: "Auto-confirm payments (high risk, off by default)",
    zh: "自动确认付款（高风险，默认关闭）",
  },
  "settings.autoconfirm.desc": {
    en: "When ON, a payment screenshot that passes AI verification — recipient matches your payment details AND the amount exactly matches the order total — confirms the order without waiting for you. Edited screenshots are a real risk; anything uncertain still comes to you. Make sure your payment details above are exact first.",
    zh: "开启后，通过 AI 核对的付款截图（收款人和你的收款资料一致，金额和订单总额完全相同）会直接确认订单，不用等你。截图有被修改的风险，任何不确定的情况还是会交给你处理。开启前请先确保上面的收款资料完全准确。",
  },
  "settings.autoconfirm.enable": { en: "Enable AI auto-confirm", zh: "启用 AI 自动确认" },
};

// --- Late additions (release batch 2) --------------------------------------
Object.assign(dict, {
  // Workspace is now a unified inbox: live channel chats + practice chats.
  "ws.subtitle": {
    en: "Every customer in one place. Live WhatsApp / IG / Messenger chats appear here automatically (GC replies on its own), and you can still start a practice chat to paste messages in by hand.",
    zh: "所有客户集中一处。WhatsApp / IG / Messenger 的真实对话会自动出现在这里（GC 会自己回复），你也可以新建练习对话手动贴消息。",
  },
  // Setup done-banner: emphasize it's re-editable forever (overrides earlier key)
  "setup.done.prefix": {
    en: "Setup complete, but this chat never closes. New bank account? New promo? Different shipping rule? Just tell GC below, like texting a colleague, and it rewires the brain instantly. You can also fine-tune by hand in ",
    zh: "设置完成，但这个对话永远不会关闭。换了银行户口？有新促销？运费规则变了？直接在下面告诉 GC，就像发消息给同事一样，大脑会立刻更新。你也可以在",
  },
  "settings.useSuggestion": { en: "Use suggestion", zh: "使用建议内容" },
  "settings.comingSoon": { en: "Releasing soon", zh: "即将推出" },
  "settings.followups.manualNote": {
    en: "Auto-sending unlocks when WhatsApp connects. Today, GC drafts follow-ups for you in the Workspace (the Suggest follow-up button) and this max still applies.",
    zh: "自动发送将在接通 WhatsApp 后开放。目前 GC 会在工作台帮你起草跟进消息（生成跟进消息按钮），上限同样生效。",
  },
} satisfies Record<string, Entry>);

export function t(lang: Lang, key: string): string {
  const entry = dict[key];
  if (!entry) return key;
  return entry[lang];
}

// The full dictionary, for the provider.
export { dict as i18nDict };
