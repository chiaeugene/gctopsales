import Link from "next/link";

export const metadata = { title: "Terms of Service — GC Top Sales" };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--canvas)] py-16 px-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-sm text-[var(--accent-ink)] hover:underline">
            ← GC Top Sales
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Terms of Service</h1>
          <p className="mt-1 text-sm text-black/45">Last updated 2026-07-17</p>
        </div>

        <section className="space-y-3 text-sm leading-relaxed text-black/75">
          <p>
            GC Top Sales is operated by Asterisk and Hashtag and provided to independent MAE Global agents
            as a sales-assistant tool. By creating an account or connecting a WhatsApp, Messenger, or
            Instagram channel, you agree to these terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">What GC Top Sales does</h2>
          <p className="text-sm text-black/75">
            GC Top Sales lets an agent connect their own WhatsApp Business number, Facebook Page, and/or
            Instagram professional account, and uses an AI assistant ("GC") to hold sales conversations,
            answer questions about MAE Global products, and help confirm and track orders on the agent&apos;s
            behalf.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Agent responsibilities</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-black/75">
            <li>You must own or have authorization to connect the WhatsApp/Facebook/Instagram accounts you link.</li>
            <li>You&apos;re responsible for the accuracy of your product catalog, pricing, and health/compliance claims shown to your customers.</li>
            <li>You must comply with Meta&apos;s Platform Terms, WhatsApp Business Messaging Policy, and applicable direct-selling / MLM regulations in your market.</li>
            <li>You&apos;re responsible for fulfilling orders your customers place through conversations GC handles.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">AI-generated replies</h2>
          <p className="text-sm text-black/75">
            GC drafts and sends replies automatically using an AI model. While tuned for consultative,
            compliant selling, it can make mistakes. Agents remain responsible for reviewing order details
            and for any AI-generated message sent under their connected accounts.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">No warranty</h2>
          <p className="text-sm text-black/75">
            GC Top Sales is provided "as is," without warranty of any kind. We do not guarantee
            uninterrupted availability of messaging channels, which depend on third-party platforms
            (Meta) outside our control.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Account termination</h2>
          <p className="text-sm text-black/75">
            We may suspend or terminate an agent&apos;s account for violating Meta&apos;s platform policies, MAE
            Global&apos;s agent agreement, or these terms. You may disconnect your channels or request account
            deletion at any time — see our{" "}
            <Link href="/privacy#data-deletion" className="text-[var(--accent-ink)] hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="text-sm text-black/75">eugene@asteriskandhashtag.com</p>
        </section>
      </div>
    </main>
  );
}
