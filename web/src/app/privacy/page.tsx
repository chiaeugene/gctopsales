import Link from "next/link";

export const metadata = { title: "Privacy Policy — GC Top Sales" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--canvas)] py-16 px-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-sm text-[var(--accent-ink)] hover:underline">
            ← GC Top Sales
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="mt-1 text-sm text-black/45">Last updated 2026-07-17</p>
        </div>

        <section className="space-y-3 text-sm leading-relaxed text-black/75">
          <p>
            GC Top Sales ("GC", "we", "us") is a sales-assistant platform operated by Asterisk and Hashtag,
            used by independent MAE Global agents ("agents") to run AI-assisted sales conversations with
            their own customers over WhatsApp, Facebook Messenger, and Instagram Direct. This policy
            explains what data we collect, why, and how you can control it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">What we collect</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-black/75">
            <li>
              <strong>From agents:</strong> account email, business setup responses (products, pricing,
              selling style), and the access tokens needed to send/receive messages on the channels they
              connect (WhatsApp Business number, Facebook Page, Instagram professional account).
            </li>
            <li>
              <strong>From an agent&apos;s customers, via the channels the agent connects:</strong> message
              content, name, phone number, delivery address, and any payment screenshots sent during a
              purchase — collected only within the conversation the customer initiates with that agent.
            </li>
            <li>
              <strong>Usage data:</strong> order and conversation status, so agents can track their own
              pipeline.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">How we use it</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-black/75">
            <li>To generate and send AI sales replies on the agent&apos;s behalf, using Anthropic&apos;s Claude API.</li>
            <li>To transcribe inbound voice messages, when enabled, using a speech-to-text provider (Groq or OpenAI Whisper).</li>
            <li>To match payment screenshots against expected order amounts and confirm orders.</li>
            <li>To show agents their own sales history, testimonials, and performance reports.</li>
          </ul>
          <p className="text-sm text-black/75">
            We do not sell personal data, and we do not use customer conversation content for advertising.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Where it&apos;s stored</h2>
          <p className="text-sm text-black/75">
            Data is stored in a PostgreSQL database hosted on Render, scoped per agent account. Access
            tokens for connected channels are never exposed to the browser once saved.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Third parties</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-black/75">
            <li>Meta Platforms, Inc. — WhatsApp Business Platform, Messenger, and Instagram messaging APIs.</li>
            <li>Anthropic — processes message content to generate AI replies.</li>
            <li>Groq / OpenAI — transcribes voice messages, when enabled.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold" id="data-deletion">
            Data deletion
          </h2>
          <p className="text-sm text-black/75">
            To request deletion of your agent account or a customer&apos;s conversation data, email{" "}
            <a className="text-[var(--accent-ink)] hover:underline" href="mailto:eugene@asteriskandhashtag.com">
              eugene@asteriskandhashtag.com
            </a>{" "}
            with the account email or the phone number / channel ID in question. We will delete the
            requested records within 30 days, except where retention is required for financial
            record-keeping (e.g. completed orders).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Children</h2>
          <p className="text-sm text-black/75">
            GC Top Sales is a business tool for adult sales agents and is not directed at children under 16.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="text-sm text-black/75">
            Questions about this policy: eugene@asteriskandhashtag.com.
          </p>
        </section>
      </div>
    </main>
  );
}
