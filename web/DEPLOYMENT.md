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

1. Create a Meta app (Business type) with WhatsApp, Messenger, and Instagram products.
2. **Webhooks:**
   - WhatsApp → callback `https://<host>/api/webhooks/whatsapp`, verify token = `META_WEBHOOK_VERIFY_TOKEN`. Subscribe to `messages`.
   - Messenger → callback `https://<host>/api/webhooks/meta`. Subscribe to `messages`, `messaging_postbacks`.
   - Instagram → callback `https://<host>/api/webhooks/meta`. Subscribe to `messages`.
3. `META_APP_SECRET` = the app secret (used to verify every inbound webhook signature).
4. Each agent connects their own numbers/pages in **Settings → Meta channels** by pasting their phone-number-id / page-id / IG-id + a permanent access token. Inbound events route to the right tenant by that id.
5. **Later:** replace manual token entry with Meta Embedded Signup (Facebook Login for Business) — it writes into the same `ChannelConnection` rows, so nothing else changes. Requires Meta app review (Advanced Access + Business/Tech-Provider verification), which is why manual credentials are the day-one path.

## 5. First-run checklist per agent

1. Admin creates the agent account (Admin tab) — catalog + brains are cloned automatically.
2. Agent logs in → **Set up GC** (conversational interview) to capture their voice and, critically, their **payment details** (GC verifies payment screenshots against these).
3. Agent optionally runs **Train GC** role-plays → "Learn my style".
4. Agent connects their channel(s) in **Settings**.
5. Agent tests in **Test GC (Playground)** before going live.
6. (Optional, high-risk) enable **auto-confirm payments** in Settings once payment details are exact.

## 6. Health-claim & compliance note

MAE products are NPRA-classified food, not medicine. GC is prompted to use only MAE's approved claim language, append "individual results may vary", advise medication spacing, and hand medical edge-cases to the human. Keep the compliance rules in each tenant's Catalog Rules brain current with MAE's guidance.
