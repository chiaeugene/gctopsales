# Deploying GC Top Sales

## 1. Database (Postgres)

Local dev currently runs on SQLite. For production switch to Postgres:

1. Create a **new** Postgres database (a fresh Supabase project is easiest — do NOT reuse Mandy's).
2. In `prisma/schema.prisma`, change the datasource block back to:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")
   }
   ```
3. Set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) to the new DB.
4. `npx prisma migrate deploy` (or `npx prisma migrate dev --name init` the first time to create the migration), then `npm run db:seed`.

`Bytes` columns (product images, payment proofs) live in Postgres `bytea` — fine for the current volume. If image volume grows, move `ProductImage.data` / `InboundAttachment.data` to object storage (S3/Supabase Storage) and keep only the URL; the byte-serving routes are the single place to change.

## 2. Environment variables

Copy `.env.example` → set every value. Minimum to boot: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (`npx auth secret`), `ANTHROPIC_API_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Add `META_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET`, `CRON_SECRET` before connecting channels + follow-ups. Set `PUBLIC_BASE_URL` if you use Instagram/Messenger attachment sends.

## 3. Deploy (Vercel recommended)

- Import the repo, set root directory to `web/`.
- Add all env vars.
- `vercel.json` already registers the follow-up cron (every 30 min). Vercel automatically attaches `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set, which the route checks.
- Build command is the default (`npm run build`, which runs `prisma generate` first).
- First deploy: run `prisma migrate deploy` + `npm run db:seed` against the prod DB (Vercel build step, a one-off script, or locally with prod env).

## 4. Meta app setup (one app serves all tenants)

One Meta app serves every agent — nobody creates their own app. Two connect
paths exist and both write into the same `ChannelConnection` table:

- **One-click connect** (`MetaConnectButtons`, Connect page): agent clicks
  "Connect with Facebook", logs in, picks their WhatsApp number / Page, done.
  No token or ID ever touches them. This is what steps 1-6 below unlock.
- **Manual paste** (always available, no setup required): agent pastes their
  own phone-number-id/page-id/IG-id + a permanent access token in
  Settings → Meta channels. Works today with zero Meta app configuration.

### Setting up one-click connect

1. **Create the Meta app**: developers.facebook.com → My Apps → Create App →
   type "Other" → "Business". Note the **App ID** and **App Secret** (App
   Dashboard → Settings → Basic).
2. **Add products**: WhatsApp, Messenger (Facebook Login comes with it),
   Instagram.
3. **Webhooks** (App Dashboard → each product → Webhooks):
   - WhatsApp → callback `https://<host>/api/webhooks/whatsapp`, verify
     token = `META_WEBHOOK_VERIFY_TOKEN`. Subscribe to `messages`.
   - Messenger/Instagram → callback `https://<host>/api/webhooks/meta`.
     Subscribe to `messages`, `messaging_postbacks`. (The connect flow
     itself also auto-subscribes each Page/WABA via the Graph API once an
     agent connects — this webhook config is the app-level default.)
4. **Facebook Login for Business** (App Dashboard → Facebook Login for
   Business → Configurations → Create): request
   `pages_show_list, pages_messaging, instagram_basic, instagram_manage_messages, pages_manage_metadata, business_management`.
   Note the configuration's **Configuration ID**.
5. **WhatsApp Embedded Signup** (App Dashboard → WhatsApp → Embedded Signup →
   Configuration → Create), linked to a WhatsApp Business Account. Note its
   **Configuration ID**.
6. Set env vars and redeploy: `META_APP_SECRET` (App Secret from step 1),
   `NEXT_PUBLIC_META_APP_ID` (App ID), `NEXT_PUBLIC_META_LOGIN_CONFIG_ID`
   (step 4), `NEXT_PUBLIC_META_WA_CONFIG_ID` (step 5).

At this point one-click connect works for **you** (the app's admins/testers)
— good enough to test the whole flow end to end immediately. To let real
agents (people with no role on your Meta app) use it:

7. **Business Verification**: Meta Business Suite → Business Settings →
   Business Info → Start Verification. Needs your business's legal
   documents; Meta reviews it (can take a few days).
8. **App Review**: App Dashboard → App Review → Request the permissions
   listed in step 4, plus `whatsapp_business_management` and
   `whatsapp_business_messaging`. Meta asks for a short screencast per
   permission showing the actual connect flow in this app — record one
   using the Connect page. Typically a few days to a couple of weeks.

Manual paste keeps working the entire time — nothing is blocked on Meta's
review clock.

## 5. First-run checklist per agent

1. Admin creates the agent account (Admin tab) — catalog + brains are cloned automatically.
2. Agent logs in → **Set up GC** (conversational interview) to capture their voice and, critically, their **payment details** (GC verifies payment screenshots against these).
3. Agent optionally runs **Train GC** role-plays → "Learn my style".
4. Agent connects their channel(s) in **Settings**.
5. Agent tests in **Test GC (Playground)** before going live.
6. (Optional, high-risk) enable **auto-confirm payments** in Settings once payment details are exact.

## 6. Health-claim & compliance note

MAE products are NPRA-classified food, not medicine. GC is prompted to use only MAE's approved claim language, append "individual results may vary", advise medication spacing, and hand medical edge-cases to the human. Keep the compliance rules in each tenant's Catalog Rules brain current with MAE's guidance.
