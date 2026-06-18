import { fmtDelta, fmtWeight, type WeightUnit } from "@/lib/weight";

type Props = {
  currentKg: number | null;
  startKg: number | null;
  goalKg: number | null;
  progressPct: number;
  unit: WeightUnit;
};

// A circular ring with a human silhouette inside that subtly scales with progress.
// Ring fills 0->100% as user moves from start weight toward goal weight.
export function BodySilhouetteRing({ currentKg, startKg, goalKg, progressPct, unit }: Props) {
  const size = 260;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, progressPct));
  const dash = (pct / 100) * circ;

  // Subtle silhouette scaling — between 0.92 (heavier) and 1.0 (at goal).
  // If no goal, just show 1.
  let scale = 1;
  if (currentKg != null && startKg != null && goalKg != null && startKg !== goalKg) {
    const t = (startKg - currentKg) / (startKg - goalKg); // 0..1
    const clamped = Math.max(0, Math.min(1, t));
    scale = 0.92 + clamped * 0.08;
  }

  const delta = currentKg != null && startKg != null ? currentKg - startKg : 0;
  const deltaColor =
    delta < -0.05
      ? "text-[color:var(--recovery-high)]"
      : delta > 0.05
        ? "text-[color:var(--recovery-low)]"
        : "text-muted-foreground";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--recovery-high)" />
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Silhouette behind the readout */}
      <svg
        viewBox="0 0 100 200"
        className="absolute inset-0 m-auto opacity-[0.08] transition-transform duration-700 ease-out"
        style={{ width: size * 0.55, height: size * 0.85, transform: `scaleX(${scale}) scaleY(${1 + (1 - scale) * 0.4})` }}
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M50 8c-9 0-16 7-16 16s7 16 16 16 16-7 16-16S59 8 50 8zm-22 42c-7 0-13 5-14 12l-6 38c-1 5 3 9 8 9 4 0 7-3 8-7l4-20v32l-6 60c-1 6 3 11 9 11s10-5 10-11l3-44h4l3 44c0 6 4 11 10 11s10-5 9-11l-6-60V94l4 20c1 4 4 7 8 7 5 0 9-4 8-9l-6-38c-1-7-7-12-14-12H28z"
        />
      </svg>

      <div className="relative z-10 text-center">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Current</div>
        <div className="text-4xl font-bold tabular-nums">{fmtWeight(currentKg, unit, 1)}</div>
        {currentKg != null && startKg != null && (
          <div className={`text-sm font-medium tabular-nums ${deltaColor}`}>
            {fmtDelta(delta, unit, 1)} vs start
          </div>
        )}
        {goalKg != null && (
          <div className="mt-1 text-xs text-muted-foreground">
            {pct.toFixed(0)}% to {fmtWeight(goalKg, unit, 1)}
          </div>
        )}
      </div>
    </div>
  );
}
