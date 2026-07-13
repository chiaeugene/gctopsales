// Pure-SVG circular score ring (stroke-dasharray trick) — no charting library.
export function ScoreRing({ value, size = 108 }: { value: number; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const offset = c * (1 - pct);
  const color = value >= 85 ? "#0f9d58" : value >= 65 ? "#c2410c" : "#dc2626";
  const grade = value >= 85 ? "A" : value >= 75 ? "B" : value >= 65 ? "C" : value >= 50 ? "D" : "F";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="score-ring"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{grade}</div>
        <div className="text-[11px] text-black/40 tabular-nums">{value}/100</div>
      </div>
    </div>
  );
}
