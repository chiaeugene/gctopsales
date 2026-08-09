"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * First-run guided tour.
 *
 * Bumping TOUR_VERSION makes the tour reappear for everyone — that is the point:
 * when the app changes, the walkthrough should be shown again rather than being
 * permanently dismissed by whoever clicked "skip" a month ago.
 *
 * "Seen" is kept in sessionStorage, not localStorage, so it comes back on every
 * fresh login (which is what was asked for) but does not nag on every click
 * within one sitting. Skipping is remembered for the session too — nobody should
 * have to dismiss the same overlay twice.
 *
 * The component lives in the app layout, so it survives the route changes it
 * triggers itself: the panel stays put while the page behind it swaps to the one
 * being explained.
 */
const TOUR_VERSION = "v1";
const KEY = `gc-tour-${TOUR_VERSION}`;

type Step = {
  n: number;
  title: string;
  href: string;
  /** Sentence one: what this screen IS. */
  what: string;
  /** Sentence two onward: why it matters and what to actually do here. */
  why: string[];
  cta: string;
};

const STEPS: Step[] = [
  {
    n: 1,
    title: "Dashboard",
    href: "/",
    what: "This is your morning screen. It answers one question: who should I message right now?",
    why: [
      "The big number is your win rate. Everything under it is supporting detail, not homework.",
      "The priority queue ranks your open chats by buying temperature, so the hottest lead is at the top instead of buried under whoever messaged most recently.",
      "If a customer has gone quiet, the dashboard is where you will notice, and GC can suggest the follow-up for you.",
    ],
    cta: "Next: set GC up",
  },
  {
    n: 2,
    title: "Set up GC",
    href: "/setup",
    what: "This is where GC learns who it is pretending to be. It answers as YOU, so it needs your details.",
    why: [
      "Your name, your city, the markets you serve, and your payment details. GC quotes prices in the right currency and sends the right bank account because of what is on this page.",
      "The payment details matter most. A customer who says yes cannot pay if GC has nothing to give them, so fill that in before you take a real chat.",
      "You can talk your way through it instead of typing forms: the setup interview asks you questions and fills the fields in for you.",
    ],
    cta: "Next: train GC",
  },
  {
    n: 3,
    title: "Train GC",
    href: "/train",
    what: "This is where GC learns how YOU sell, not just what you sell.",
    why: [
      "You role-play a customer, GC replies, and you correct it. Each correction is kept as an example.",
      "This is the part people miss: training is not a separate practice mode. What you teach here is written back into your settings and shipped into GC's actual instructions, so it changes how GC answers real customers on WhatsApp from the next message onward.",
      "That is also why it is worth being fussy. If you tell GC once that you never push the biggest package first, it will stop doing that everywhere, not only in the chat where you said it.",
    ],
    cta: "Next: discovery questions",
  },
  {
    n: 4,
    title: "Discovery",
    href: "/discovery",
    what: "Your question menus. This is the \"1. Pores  2. Dark spots  3. Dull skin\" style of asking.",
    why: [
      "Instead of guessing what a customer needs, GC can offer them a short numbered list and let them pick. People answer a menu far more often than they answer an open question.",
      "It is optional, and it is not a script. When it is on, GC decides WHEN to use a menu rather than opening every conversation with one.",
      "Menus can be written in Malay and Mandarin as well, and GC will use the version that matches the language the customer is typing in.",
    ],
    cta: "Last step: try it live",
  },
  {
    n: 5,
    title: "Workspace",
    href: "/playground",
    what: "This is where the selling happens, and where you can safely test it first.",
    why: [
      "Every chat lives here, practice ones and real WhatsApp ones side by side, so it is one inbox rather than two.",
      "A practice chat runs through exactly the same engine as a real customer. Nothing is faked and nothing is sent to anybody.",
      "You can take a conversation over from GC at any time, and hand it back when you are done.",
    ],
    cta: "Send a demo message",
  },
];

/** Three real messages, run through the real engine, so the tour ends in a reply. */
const DEMOS = [
  { label: "A cold opener", text: "Hi, saw your post. What is this product?" },
  { label: "A skin problem", text: "My skin very bad lately, so many pores and dull. Can help?" },
  { label: "The price objection", text: "Wah so expensive. Cheaper one got or not?" },
];

type Demo = { text: string; reply?: string; error?: string; busy?: boolean };

export function GuidedTour({ agentName }: { agentName: string }) {
  const [step, setStep] = useState<number | null>(null); // null = closed
  const [demos, setDemos] = useState<Demo[]>([]);
  const [demoOrderId, setDemoOrderId] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(KEY)) return;
    // Never hijack a page the user navigated to deliberately mid-session; the
    // tour opens from the dashboard, which is where login lands.
    if (pathname !== "/") return;
    setStep(0);
  }, [pathname]);

  const close = useCallback(() => {
    sessionStorage.setItem(KEY, "done");
    setStep(null);
  }, []);

  const goto = useCallback(
    (n: number) => {
      setStep(n);
      const href = STEPS[n - 1]?.href;
      if (href && href !== pathname) router.push(href);
    },
    [pathname, router]
  );

  /** Runs a demo message against the live engine in a throwaway practice chat. */
  async function runDemo(text: string) {
    setDemos((d) => [...d, { text, busy: true }]);
    const mark = (patch: Partial<Demo>) =>
      setDemos((d) => d.map((x) => (x.text === text ? { ...x, busy: false, ...patch } : x)));
    try {
      let orderId = demoOrderId;
      if (!orderId) {
        const made = await fetch("/api/playground/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Tour demo" }),
        });
        const json = await made.json();
        if (!made.ok) throw new Error(json.error || "Could not open a demo chat");
        orderId = json.orderId as string;
        setDemoOrderId(orderId);
      }
      const res = await fetch("/api/playground/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, message: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "GC could not reply");
      mark({ reply: json.reply ?? "(GC paused this chat for a human to answer.)" });
    } catch (e) {
      mark({ error: e instanceof Error ? e.message : "Something went wrong" });
    }
  }

  if (step === null) return null;

  // ---------------------------------------------------------------- intro ----
  if (step === 0) {
    return (
      <Shell onSkip={close}>
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent-ink)]">
          Welcome{agentName ? `, ${agentName}` : ""}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Five screens, in the order that matters</h2>
        <p className="mt-3 text-sm leading-relaxed text-black/60">
          GC Top Sales answers your customers for you. Before you point it at a real WhatsApp, it needs to know who
          you are, how you sell, and what to ask. That is what these five steps cover, and the last one ends with GC
          actually replying to a message so you can see it work.
        </p>
        <ol className="mt-5 space-y-1.5">
          {STEPS.map((s) => (
            <li key={s.n} className="flex items-center gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent-ink)]">
                {s.n}
              </span>
              <span className="font-medium">{s.title}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex items-center gap-3">
          <Button onClick={() => goto(1)}>Start the tour</Button>
          <button onClick={close} className="text-sm text-black/40 hover:text-black/70">
            Skip, I know my way around
          </button>
        </div>
      </Shell>
    );
  }

  const s = STEPS[step - 1];
  const isLast = step === STEPS.length;

  return (
    <Shell onSkip={close}>
      <div className="flex items-center gap-2">
        {STEPS.map((x) => (
          <span
            key={x.n}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              x.n <= s.n ? "bg-[var(--accent)]" : "bg-black/10"
            }`}
          />
        ))}
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wider text-[var(--accent-ink)]">
        Step {s.n} of {STEPS.length}
      </p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{s.title}</h2>
      <p className="mt-2 text-sm font-medium leading-relaxed">{s.what}</p>
      <ul className="mt-3 space-y-2">
        {s.why.map((line) => (
          <li key={line} className="flex gap-2.5 text-sm leading-relaxed text-black/60">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {isLast && (
        <div className="mt-5 rounded-2xl bg-black/[0.02] p-4">
          <p className="text-sm font-medium">Try it now. These go through the real engine.</p>
          <p className="mt-1 text-xs text-black/45">
            Nothing is sent to a customer. It lands in a practice chat called &ldquo;Tour demo&rdquo; that you can
            delete afterwards.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEMOS.map((d) => (
              <button
                key={d.text}
                onClick={() => runDemo(d.text)}
                disabled={demos.some((x) => x.text === d.text)}
                className="rounded-full border border-black/10 bg-white px-3.5 py-2 text-left text-xs transition-colors hover:border-[var(--accent)] disabled:opacity-40"
              >
                <span className="block font-medium">{d.label}</span>
                <span className="block text-black/45">&ldquo;{d.text}&rdquo;</span>
              </button>
            ))}
          </div>
          {demos.length > 0 && (
            <div className="mt-4 space-y-3">
              {demos.map((d) => (
                <div key={d.text} className="text-xs">
                  <p className="text-black/45">You: {d.text}</p>
                  {d.busy && <p className="mt-1 text-black/40">GC is typing…</p>}
                  {d.error && <p className="mt-1 text-red-600">{d.error}</p>}
                  {d.reply && (
                    <p className="mt-1 whitespace-pre-wrap rounded-xl bg-[var(--accent-soft)] p-3 leading-relaxed text-[var(--accent-ink)]">
                      {d.reply}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        {isLast ? (
          <Button onClick={close}>Done, take me to my chats</Button>
        ) : (
          <Button onClick={() => goto(step + 1)}>{s.cta}</Button>
        )}
        {s.n > 1 && (
          <button onClick={() => goto(step - 1)} className="text-sm text-black/40 hover:text-black/70">
            Back
          </button>
        )}
        <button onClick={close} className="ml-auto text-sm text-black/40 hover:text-black/70">
          Skip
        </button>
      </div>
    </Shell>
  );
}

/**
 * The overlay dims the app but does not block it: the panel sits bottom-right on
 * desktop so the screen being explained stays visible and clickable behind it. A
 * modal in the middle of the page would hide the very thing it is describing.
 */
function Shell({ children, onSkip }: { children: React.ReactNode; onSkip: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-end sm:justify-end sm:p-6">
      <div className="pointer-events-auto max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-black/[0.06] bg-white/95 p-6 shadow-[0_24px_64px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        {children}
      </div>
    </div>
  );
}
