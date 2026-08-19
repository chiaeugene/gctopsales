"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * First-run guided tour.
 *
 * The panel is ANCHORED: each step names a `data-tour` element, and the tour
 * scrolls to it, dims everything else, rings it with a dashed outline, and puts
 * the explanation right next to it with a dotted line joining the two. A fixed
 * corner panel was the first attempt and it was wrong — the words were nowhere
 * near the thing they described, so it read as a leaflet rather than a tour.
 *
 * Bumping TOUR_VERSION makes the tour reappear for everyone. "Seen" lives in
 * sessionStorage, so it comes back on every fresh login but does not nag on
 * every click within one sitting.
 *
 * Mounted in the app layout, so it survives the route changes it triggers
 * itself: the page behind it swaps while the tour keeps its place.
 */
const TOUR_VERSION = "v3";
const KEY = `gc-tour-${TOUR_VERSION}`;

type Step = {
  n: number;
  title: string;
  href: string;
  /** data-tour attribute of the element to ring. */
  anchor: string;
  /** One line: what this thing IS. */
  what: string;
  /** Why it matters and what to do with it. */
  why: string[];
  cta: string;
};

const STEPS: Step[] = [
  {
    n: 1,
    title: "Your numbers",
    href: "/",
    anchor: "dashboard-stats",
    what: "The dashboard opens on four numbers, and only one of them is a score.",
    why: [
      "Win rate is the one to watch. The other three tell you where the work is sitting: conversations you have opened, orders paid, and orders still waiting for money.",
      "Awaiting payment is the most actionable of the four. Those are people who already said yes.",
    ],
    cta: "Next: who to message first",
  },
  {
    n: 2,
    title: "Priority queue",
    href: "/",
    anchor: "dashboard-queue",
    what: "This answers the only question that matters in the morning: who do I message right now?",
    why: [
      "Chats are ranked by buying temperature, not by who messaged last. A hot lead from Tuesday outranks a browser from ten minutes ago.",
      "If someone has gone quiet, this is where you notice, and GC will draft the follow-up for you rather than leaving you to think of one.",
    ],
    cta: "Next: set GC up",
  },
  {
    n: 3,
    title: "Your catalogue",
    href: "/products",
    anchor: "products-yours",
    what: "These products came pre-loaded, and every one of them is yours to change.",
    why: [
      "Prices, descriptions, selling notes, photos: all editable. Add your own products, switch off anything you do not sell.",
      "This matters because GC quotes exactly what is on this page. If a price here is wrong, that is the price your customer hears.",
    ],
    cta: "Next: set GC up",
  },
  {
    n: 4,
    title: "Set up GC",
    href: "/setup",
    anchor: "setup-interview",
    what: "GC answers customers as YOU, so first it has to learn who you are.",
    why: [
      "You talk, it asks. Your name, your city, the markets you serve, how you ship, and how customers pay you. No forms.",
      "Everything you say here is saved into your Settings. Setup is not a separate thing from Settings, it is the friendly way of filling Settings in, and you can go and edit any of it by hand later.",
      "The three that matter most: your bank name, the account holder's name, and the account number. With all three, GC closes the sale on its own — it sends your details the moment a customer says yes. Missing any one, and GC has to hand the chat back to you at the exact moment money moves.",
    ],
    cta: "Next: train GC",
  },
  {
    n: 5,
    title: "Train GC",
    href: "/train",
    anchor: "train-chat",
    what: "This is where GC learns how YOU sell, not just what you sell.",
    why: [
      "You play the customer, GC replies, and you correct it. Each correction is kept as an example of your style.",
      "Here is the part people miss: this is not a practice mode that gets thrown away. What you teach here is written back into your Settings, the same fields you saw in setup, and shipped into GC's real instructions.",
      "So it changes how GC answers actual customers on WhatsApp from the next message onward. Tell it once that you never push the biggest package first, and it stops doing that everywhere, not only in the chat where you said it.",
      "And you cannot break anything: Settings has a Start GC over button that puts everything back on the team defaults, keeping your payment details, products and chats.",
    ],
    cta: "Next: discovery questions",
  },
  {
    n: 6,
    title: "Discovery",
    href: "/discovery",
    anchor: "discovery-toggle",
    what: "Your question menus. The \"1. Pores  2. Dark spots  3. Dull skin\" way of asking.",
    why: [
      "Rather than guessing what a customer needs, GC offers a short numbered list and lets them pick. People answer a menu far more often than an open question.",
      "One switch, two separate things: whether menus are on at all, and how the questions are written. Both are on this page.",
      "It is not a script. When it is on, GC still decides WHEN a menu helps instead of opening every conversation with one. Menus can be written in Malay and Mandarin too, and GC uses the version matching the language the customer types in.",
    ],
    cta: "Next: try it live",
  },
  {
    n: 7,
    title: "Workspace",
    href: "/playground",
    anchor: "workspace-composer",
    what: "Where the selling happens, and where you can safely test it first.",
    why: [
      "Every chat lives here, practice ones and real WhatsApp ones side by side. One inbox, not two.",
      "A practice chat runs through exactly the same engine as a real customer. Nothing is faked, and nothing is sent to anybody.",
      "You can take a conversation over from GC whenever you want, and hand it back when you are done.",
    ],
    cta: "Next: go live on WhatsApp",
  },
  {
    n: 8,
    title: "Connect",
    href: "/connect",
    anchor: "connect-health",
    what: "This is where GC goes live: link your WhatsApp Business, then let this panel prove it works.",
    why: [
      "One button connects your WhatsApp. You log in with Facebook, pick your number, done — no tokens, no copying IDs.",
      "Then press Run the full check. It tests every step a customer message travels, for real, and tells you the exact thing to fix if anything is off.",
      "All green means you are live: a customer messaging your number right now gets an answer. You get 100 GC replies a day, more than a full day of selling needs.",
    ],
    cta: "Last step: Settings",
  },
  {
    n: 9,
    title: "Settings",
    href: "/settings",
    anchor: "settings-tone",
    what: "This is where setup and training actually end up. Nothing here is decoration.",
    why: [
      "Every answer you gave in setup and every correction you made in training is stored in these fields. Reading this page tells you exactly what GC believes about you.",
      "Which is also how you fix a habit fast. If GC keeps doing something you dislike, you do not have to role-play it away, you can edit the field here and the next reply changes.",
      "Tone, message shape, emoji, whether bullet lists are allowed, discovery, and your payment and shipping details all live here.",
    ],
    cta: "Done, take me to my chats",
  },
];

/**
 * Six demo messages, deliberately spread across product lines and languages, so
 * the first thing an agent sees is GC handling a range rather than one lucky
 * script. Each runs through the real engine.
 */
const DEMOS = [
  { label: "A cold opener", tag: "no context at all", text: "Hi, saw your post. What is this product?" },
  { label: "Skin", tag: "pores and dullness", text: "My skin very bad lately, so many pores and look so dull. Can help?" },
  { label: "Hair", tag: "hair fall", text: "My hair drop a lot every time I shower. Got shampoo for that?" },
  { label: "Gut", tag: "bloating, constipation", text: "I always bloated and cannot go toilet properly. Anything can help my stomach?" },
  { label: "Sleep and stress", tag: "in Mandarin", text: "最近压力很大，晚上睡不好，有什么可以帮我吗？" },
  { label: "The price objection", tag: "after a quote", text: "Wah so expensive. Got cheaper one or not?" },
];

type Demo = { text: string; reply?: string; error?: string; busy?: boolean };

export function GuidedTour({
  agentName,
  isAdmin,
  seenCount,
}: {
  agentName: string;
  isAdmin: boolean;
  seenCount: number;
}) {
  const [step, setStep] = useState<number | null>(null); // null = closed, 0 = intro
  const [demos, setDemos] = useState<Demo[]>([]);
  const [demoOrderId, setDemoOrderId] = useState<string | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelSize, setPanelSize] = useState({ w: 400, h: 320 });
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // ?tour=1 replays it deliberately, any time, for anyone — and a deliberate
    // replay never counts against the two auto-openings.
    if (params.get("tour") === "1") {
      sessionStorage.removeItem(KEY);
      setStep(0);
      return;
    }
    if (sessionStorage.getItem(KEY)) return;
    // Otherwise only open from the dashboard, which is where login lands. Never
    // hijack a page somebody navigated to on purpose mid-session.
    if (pathname !== "/") return;
    // Agents get the auto-tour twice, then it stays out of the way: by the third
    // login it is repetition, not onboarding. Admins keep it every login for now,
    // since they demo the product. The count survives cleared browsers because it
    // lives on the profile, and it increments once per session, guarded so a
    // mid-session reload does not burn a second viewing.
    if (!isAdmin && seenCount >= 2) return;
    if (!isAdmin && !sessionStorage.getItem("gc-tour-counted")) {
      sessionStorage.setItem("gc-tour-counted", "1");
      fetch("/api/tour/seen", { method: "POST" }).catch(() => {});
    }
    setStep(0);
  }, [pathname, params, isAdmin, seenCount]);

  const close = useCallback(() => {
    sessionStorage.setItem(KEY, "done");
    setStep(null);
    setRect(null);
  }, []);

  const goto = useCallback(
    (n: number) => {
      setRect(null); // drop the old ring immediately, so it never points at the wrong thing
      setStep(n);
      const href = STEPS[n - 1]?.href;
      if (href && href !== pathname) router.push(href);
    },
    [pathname, router]
  );

  const anchor = step && step > 0 ? STEPS[step - 1].anchor : null;

  // Find, scroll to, and measure the anchor. The element may not exist yet: a
  // step can trigger a route change, and the new page mounts asynchronously, so
  // this polls briefly rather than giving up on the first miss.
  useEffect(() => {
    if (!anchor) return;
    let cancelled = false;
    let settle: ReturnType<typeof setTimeout>;

    const attempt = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
      if (!el) return false;
      if (window.innerWidth < 640) {
        // Park it near the top, clear of the fixed mobile header, so the bottom
        // panel cannot cover it.
        const y = window.scrollY + el.getBoundingClientRect().top - 96;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      } else {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      // Measure after the smooth scroll finishes, otherwise the ring lands where
      // the element used to be.
      settle = setTimeout(() => {
        if (!cancelled) setRect(el.getBoundingClientRect());
      }, 420);
      return true;
    };

    if (attempt()) return () => {
      cancelled = true;
      clearTimeout(settle);
    };

    let tries = 0;
    const poll = setInterval(() => {
      tries += 1;
      if (attempt() || tries > 25) clearInterval(poll);
    }, 150);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearTimeout(settle);
    };
  }, [anchor, pathname]);

  // Keep the ring glued to the element while the page moves under it.
  useEffect(() => {
    if (!anchor) return;
    const sync = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [anchor]);

  // Real panel size drives placement — a guessed height puts the panel half
  // off-screen on the steps with the most text.
  useLayoutEffect(() => {
    if (!panelRef.current) return;
    const r = panelRef.current.getBoundingClientRect();
    setPanelSize((p) => (Math.abs(p.h - r.height) < 4 && Math.abs(p.w - r.width) < 4 ? p : { w: r.width, h: r.height }));
  }, [step, demos.length]);

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
      <>
        <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/70 bg-white/95 p-7 shadow-[0_24px_64px_rgba(0,0,0,0.22)]">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent-ink)]">
              Welcome{agentName ? `, ${agentName}` : ""}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Nine stops, in the order that matters</h2>
            <p className="mt-3 text-sm leading-relaxed text-black/60">
              GC Top Sales answers your customers for you. Before you point it at a real WhatsApp it needs to know who
              you are, how you sell, and what to ask. We will walk the screens in that order, try six real messages, switch your WhatsApp on, and finish where
              all of it is stored.
            </p>
            <ol className="mt-5 grid gap-1.5 sm:grid-cols-2">
              {STEPS.map((s) => (
                <li key={s.n} className="flex items-center gap-2.5 text-sm">
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
          </div>
        </div>
      </>
    );
  }

  const s = STEPS[step - 1];
  const isWorkspace = s.anchor === "workspace-composer";
  const isLast = step === STEPS.length;
  const place = placePanel(rect, panelSize);

  return (
    <>
      {/* One element dims the whole page and cuts a hole over the anchor, via a
          box-shadow larger than any viewport. Cheaper and crisper than four
          separate blocking divs, and the hole stays clickable. */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-40 rounded-2xl border-2 border-dashed border-[var(--accent)] transition-all duration-300 ease-out"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45), 0 0 0 4px rgba(255,255,255,0.35) inset",
          }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-40 bg-black/45" />
      )}

      {/* Dotted leader joining the ring to the panel, so the eye knows which
          block of text belongs to which box on the page. */}
      {rect && place.line && (
        <svg aria-hidden className="pointer-events-none fixed inset-0 z-50 h-full w-full">
          <line
            x1={place.line.x1}
            y1={place.line.y1}
            x2={place.line.x2}
            y2={place.line.y2}
            stroke="var(--accent)"
            strokeWidth="2"
            strokeDasharray="3 5"
            strokeLinecap="round"
          />
          <circle cx={place.line.x2} cy={place.line.y2} r="3.5" fill="var(--accent)" />
        </svg>
      )}

      <div
        ref={panelRef}
        className="fixed z-50 w-[min(26rem,calc(100vw-1.5rem))] max-h-[56vh] sm:max-h-[80vh] overflow-y-auto rounded-3xl border border-white/70 bg-white/97 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.28)] transition-all duration-300 ease-out"
        style={{ top: place.top, left: place.left }}
      >
        <div className="flex items-center gap-1.5">
          {STEPS.map((x) => (
            <span
              key={x.n}
              className={`h-1.5 flex-1 rounded-full transition-colors ${x.n <= s.n ? "bg-[var(--accent)]" : "bg-black/10"}`}
            />
          ))}
        </div>
        <p className="mt-3.5 text-xs font-medium uppercase tracking-wider text-[var(--accent-ink)]">
          Step {s.n} of {STEPS.length}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{s.title}</h2>
        <p className="mt-2 text-sm font-medium leading-relaxed">{s.what}</p>
        <ul className="mt-2.5 space-y-2">
          {s.why.map((line) => (
            <li key={line} className="flex gap-2.5 text-sm leading-relaxed text-black/60">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        {isWorkspace && (
          <div className="mt-4 rounded-2xl bg-black/[0.03] p-3.5">
            <p className="text-sm font-medium">Try it. These go through the real engine.</p>
            <p className="mt-1 text-xs text-black/45">
              Six different customers across skin, hair, gut, stress and price, one of them in Mandarin. Nothing is sent
              to anybody. It all lands in a practice chat called &ldquo;Tour demo&rdquo; you can delete after.
            </p>
            <div className="mt-3 grid gap-1.5">
              {DEMOS.map((d) => (
                <button
                  key={d.text}
                  onClick={() => runDemo(d.text)}
                  disabled={demos.some((x) => x.text === d.text)}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-left text-xs transition-colors hover:border-[var(--accent)] disabled:opacity-40"
                >
                  <span className="font-medium">{d.label}</span>
                  <span className="text-black/35"> · {d.tag}</span>
                  <span className="mt-0.5 block text-black/45">&ldquo;{d.text}&rdquo;</span>
                </button>
              ))}
            </div>
            {demos.length > 0 && (
              <div className="mt-3.5 space-y-2.5 border-t border-black/[0.06] pt-3">
                {demos.map((d) => (
                  <div key={d.text} className="text-xs">
                    <p className="text-black/40">You: {d.text}</p>
                    {d.busy && <p className="mt-1 text-black/40">GC is typing…</p>}
                    {d.error && <p className="mt-1 text-red-600">{d.error}</p>}
                    {d.reply && (
                      <p className="mt-1 whitespace-pre-wrap rounded-xl bg-[var(--accent-soft)] p-2.5 leading-relaxed text-[var(--accent-ink)]">
                        {d.reply}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <Button onClick={() => (isLast ? close() : goto(step + 1))}>{s.cta}</Button>
          {s.n > 1 && (
            <button onClick={() => goto(step - 1)} className="text-sm text-black/40 hover:text-black/70">
              Back
            </button>
          )}
          <button onClick={close} className="ml-auto text-sm text-black/40 hover:text-black/70">
            Skip
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Put the panel beside the ring: below if there is room, else above, else to
 * whichever side is roomier, and clamped so it never hangs off screen. With no
 * anchor yet it centres, because a panel pinned to a corner while the page is
 * still loading looks broken.
 */
function placePanel(
  rect: DOMRect | null,
  panel: { w: number; h: number }
): { top: number; left: number; line?: { x1: number; y1: number; x2: number; y2: number } } {
  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const M = 16; // margin from the ring and from the viewport edge

  if (!rect) return { top: Math.max(M, (vh - panel.h) / 2), left: Math.max(M, (vw - panel.w) / 2) };

  // Phones: always pinned to the bottom. There is no room to sit beside
  // anything, and a panel that floats over the ring explains nothing.
  if (vw < 640) {
    const top = Math.max(M, vh - panel.h - M);
    const left = Math.max(M, (vw - panel.w) / 2);
    return {
      top,
      left,
      line: { x1: left + panel.w / 2, y1: top, x2: rect.left + rect.width / 2, y2: Math.min(rect.bottom + 8, top - 6) },
    };
  }

  const clampX = (x: number) => Math.min(Math.max(M, x), Math.max(M, vw - panel.w - M));
  const clampY = (y: number) => Math.min(Math.max(M, y), Math.max(M, vh - panel.h - M));

  const below = rect.bottom + M + panel.h + M <= vh;
  const above = rect.top - M - panel.h - M >= 0;
  const rightRoom = vw - rect.right;
  const leftRoom = rect.left;

  if (below || above) {
    const top = below ? rect.bottom + M + 8 : rect.top - panel.h - M - 8;
    const left = clampX(rect.left + rect.width / 2 - panel.w / 2);
    const y2 = below ? rect.bottom + 8 : rect.top - 8;
    return {
      top: clampY(top),
      left,
      line: { x1: left + panel.w / 2, y1: below ? top : top + panel.h, x2: rect.left + rect.width / 2, y2 },
    };
  }

  // No vertical room: go sideways.
  const onRight = rightRoom >= leftRoom;
  const left = clampX(onRight ? rect.right + M + 8 : rect.left - panel.w - M - 8);
  const top = clampY(rect.top + rect.height / 2 - panel.h / 2);
  return {
    top,
    left,
    line: {
      x1: onRight ? left : left + panel.w,
      y1: top + panel.h / 2,
      x2: onRight ? rect.right + 8 : rect.left - 8,
      y2: rect.top + rect.height / 2,
    },
  };
}
