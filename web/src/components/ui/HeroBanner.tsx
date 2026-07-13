import Image from "next/image";
import type { ReactNode } from "react";

// Full-bleed photo hero using MAE Global's own product photography (we're
// their agent platform) with the brand's real purple as a gradient overlay —
// not a stock-photo/gradient-blob placeholder.
export function HeroBanner({
  image,
  eyebrow,
  title,
  subtitle,
  stats,
}: {
  image: string;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  stats?: { label: string; value: ReactNode }[];
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl animate-fade-up [box-shadow:var(--shadow-purple)]">
      <div className="relative h-[280px] sm:h-[320px] w-full">
        <Image src={image} alt="" fill priority className="object-cover object-top" sizes="100vw" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(115deg, rgba(74,43,133,0.94) 0%, rgba(107,65,180,0.82) 35%, rgba(107,65,180,0.45) 65%, rgba(107,65,180,0.15) 100%)",
          }}
        />
      </div>
      <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-10">
        {eyebrow && (
          <div className="text-[12px] font-semibold tracking-wide uppercase text-white/70 mb-2">{eyebrow}</div>
        )}
        <h1 className="text-[32px] sm:text-[40px] leading-[1.05] font-semibold tracking-tight text-white max-w-lg">
          {title}
        </h1>
        {subtitle && <p className="mt-2.5 text-[15px] text-white/80 max-w-md">{subtitle}</p>}

        {stats && stats.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-white/12 backdrop-blur-md border border-white/20 px-4 py-2.5"
              >
                <div className="text-lg font-semibold text-white tabular-nums leading-none">{s.value}</div>
                <div className="text-[11px] text-white/70 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
