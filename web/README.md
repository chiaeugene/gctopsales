# GC Top Sales

Multi-tenant AI sales machine for MAE Global agents — WhatsApp, Instagram DM, and Facebook Messenger. Built on the Mandy architecture ("the AI suggests, code decides") adapted for physical-goods ecommerce.

## What it does

Each **agent account (tenant)** gets an isolated workspace: their own Meta channel connections, their own customers/orders, their own payment details — all pre-loaded with the full MAE catalog (26 products, member/retail pricing) and the GC Top Sales knowledge base compiled from MAE's own consultant-training FAQs (`../research/`).

GC (the AI) runs a **stage-aware sales pipeline**, not a Q&A bot:
- problem-first discovery → segment detection (working mum / 三高 / postpartum / muscle-goal / screen-fatigue…) → one best-fit recommendation with the matching mechanism story → retail-vs-member price anchoring → bundle-ladder sizing honest to the goal → in-chat close (structured cart proposal, code-recomputed prices) → payment instructions → proof-screenshot handling → post-sale usage coaching
- proactive **follow-ups** on silent leads (configurable delay + cap, cron-driven)
- **compliance guardrails** baked in: approved health-claim language only, no invented discounts, no invented payment details, refunds/medical edge-cases/distributor questions escalate to the human agent

### The money rule

`Payment Confirmed` (and beyond) can never be entered by the AI's free-form suggestion. Only two paths exist, both through `src/lib/orders/confirm-payment.ts`:
1. the agent's manual edit (order detail page / PATCH endpoint)
2. the **opt-in** vision auto-confirm: proof screenshot must pass recipient-match against the tenant's configured payment details **AND exact amount-match against the order total** (±RM0.50) **AND** ≥85% model confidence — thresholds in plain code, full verdict stored for audit.

## Run it

```bash
cd web
npm install
npx prisma db push   # dev DB (SQLite currently — see below)
npm run db:seed      # admin account + MAE catalog + brains
npm run dev          # http://localhost:3000
```

Login with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (seed defaults: `admin@gctopsales.local` / `gctopsales-admin`).

**Before selling for real**, fill in Settings → Fulfillment Brain → payment methods + instructions (the proof-verification matches against these), and create agent accounts in Admin.

## Database

Local dev currently runs SQLite (this machine has no Postgres). For production:
1. `prisma/schema.prisma` → `provider = "postgresql"`, restore `directUrl = env("DIRECT_URL")`
2. Point `DATABASE_URL`/`DIRECT_URL` at a **new** Postgres (do NOT reuse Mandy's)
3. `npx prisma migrate dev` then `npm run db:seed`

## Meta channels (manual-credentials phase)

Each tenant pastes their own credentials in Settings → Meta channels:
- **WhatsApp**: phone number ID + permanent access token (from their WABA / your Meta app)
- **Messenger**: Facebook Page ID + page access token
- **Instagram**: IG business account ID + page access token

Configure your Meta app's webhooks (one app serves all tenants):
- WhatsApp product → `https://<host>/api/webhooks/whatsapp`
- Messenger + Instagram products → `https://<host>/api/webhooks/meta`
- Verify token: `META_WEBHOOK_VERIFY_TOKEN`; signature: `META_APP_SECRET`

Inbound events route to the right tenant by phone-number-id / page-id / IG-id → `ChannelConnection`. The future one-click Embedded Signup flow writes into the same table, so nothing downstream changes.

## Follow-up scheduler

`POST /api/cron/follow-ups` with `Authorization: Bearer $CRON_SECRET` — run it every 15-30 min (Vercel cron / any scheduler). Keep tenants' follow-up delay under 24h so messages land inside Meta's customer-service window.

## Layout

```
prisma/schema.prisma      multi-tenant models (User/StoreProfile/ChannelConnection/
                          Product/Order/Conversation/Message/attachments)
prisma/seed.ts            MAE catalog + brains (THE knowledge base — edit here, re-seed)
src/lib/ai/               llm, schemas (output contract incl. proposedOrder),
                          prompts (the sales-machine system prompt), engine
                          (guarded effects), vision (amount-match verification)
src/lib/orders/           confirm-payment.ts — the ONLY money-state writer
src/lib/webhooks/         channel-agnostic inbound core + Meta signature/body-cap
src/lib/channels/         WhatsApp Cloud API + Messenger/IG Send API clients
src/app/api/              settings, channels, products, orders (+takeover),
                          playground, attachments, admin/tenants, webhooks, cron
src/app/(app)/            dashboard, orders CRM, products, playground, settings, admin
```

Architecture rationale: `../ARCHITECTURE.md`. MAE product research: `../research/MAE_RESEARCH.md`.
