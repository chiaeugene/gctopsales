"use client";

import Link from "next/link";
import { ShadcnButton } from "@/components/ui/shadcn-button";
import { FaWhatsapp, FaFacebookMessenger, FaInstagram } from "react-icons/fa";

// Orbiting-channel hero — adapted from a community "stack" hero pattern
// (icons orbiting a center node) but re-themed for GC Top Sales: the center
// node is the brand mark and the orbiting icons are the three real channels
// GC sells through (WhatsApp / Messenger / Instagram), not generic tech
// logos. Pure CSS animation, no chart/animation library.
const channelIcons = [
  { Icon: FaWhatsapp, color: "#25D366" },
  { Icon: FaFacebookMessenger, color: "#0084FF" },
  { Icon: FaInstagram, color: "#E1306C" },
];

export default function FeatureSection() {
  const orbitCount = 2;
  const orbitGap = 7.5; // rem between orbits
  const iconsPerOrbit = 3;

  return (
    <section className="relative rounded-3xl border border-black/[0.06] bg-white overflow-hidden animate-fade-up [box-shadow:var(--shadow-md)]">
      <div className="relative flex flex-col md:flex-row items-center md:justify-between h-auto md:h-[22rem] px-8 md:pl-10 py-10 md:py-0">
        {/* Left: heading + copy */}
        <div className="w-full md:w-1/2 z-10 text-center md:text-left">
          <div className="text-[12px] font-semibold tracking-wide uppercase text-[var(--accent-ink)] mb-2">
            Always-on selling
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3 text-[var(--ink)]">
            One AI seller.
            <br />
            Every channel.
          </h2>
          <p className="text-black/55 mb-6 max-w-md mx-auto md:mx-0 text-[15px]">
            GC replies on WhatsApp, Messenger, and Instagram the moment a customer messages — same sales brain,
            same MAE knowledge, never off duty.
          </p>
          <div className="flex items-center justify-center md:justify-start gap-3">
            <ShadcnButton asChild>
              <Link href="/playground">Test GC live</Link>
            </ShadcnButton>
            <ShadcnButton asChild variant="outline">
              <Link href="/leaderboard">View leaderboard</Link>
            </ShadcnButton>
          </div>
        </div>

        {/* Right: orbit animation */}
        <div className="relative w-full md:w-1/2 h-64 md:h-full flex items-center justify-center md:justify-end overflow-hidden mt-8 md:mt-0">
          <div className="relative w-[26rem] h-[26rem] md:translate-x-[15%] flex items-center justify-center">
            {/* Center node — brand mark */}
            <div
              className="relative w-20 h-20 rounded-full flex items-center justify-center text-white font-semibold text-lg tracking-tight [box-shadow:var(--shadow-purple)]"
              style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-ink) 100%)" }}
            >
              GC
            </div>

            {[...Array(orbitCount)].map((_, orbitIdx) => {
              const size = `${12 + orbitGap * (orbitIdx + 1)}rem`;
              const angleStep = (2 * Math.PI) / iconsPerOrbit;
              const offset = orbitIdx * 0.5; // stagger icon phase between orbits

              return (
                <div
                  key={orbitIdx}
                  className="absolute rounded-full border border-dashed border-[var(--accent-soft-2)] orbit-spin"
                  style={{
                    width: size,
                    height: size,
                    animationDuration: `${18 + orbitIdx * 8}s`,
                    animationDirection: orbitIdx % 2 === 0 ? "normal" : "reverse",
                  }}
                >
                  {channelIcons.map((cfg, iconIdx) => {
                    const angle = (iconIdx + offset) * angleStep;
                    const x = 50 + 50 * Math.cos(angle);
                    const y = 50 + 50 * Math.sin(angle);
                    const Icon = cfg.Icon;
                    return (
                      <div
                        key={iconIdx}
                        className="absolute bg-white rounded-full p-2.5 [box-shadow:var(--shadow-sm)] border border-black/[0.05]"
                        style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
                      >
                        <Icon className="w-6 h-6" style={{ color: cfg.color }} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
