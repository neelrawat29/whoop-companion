import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { fmtDelta, fmtWeight, toDisplay, unitLabel, type WeightUnit } from "@/lib/weight";

type Props = {
  currentKg: number | null;
  startKg: number | null;
  goalKg: number | null;
  progressPct: number;
  unit: WeightUnit;
};

export function BodySilhouetteRing({ currentKg, startKg, goalKg, progressPct, unit }: Props) {
  const size = 280;
  const stroke = 12;
  const r = (size - stroke) / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, progressPct));
  const dash = (pct / 100) * circ;

  // Silhouette morph: width slims more, height stays close.
  let widthScale = 1;
  let heightScale = 1;
  if (currentKg != null && startKg != null && goalKg != null && startKg !== goalKg) {
    const t = (startKg - currentKg) / (startKg - goalKg);
    const clamped = Math.max(0, Math.min(1, t));
    widthScale = 1.02 - clamped * 0.08; // 1.02 → 0.94
    heightScale = 1 + clamped * 0.01;
  }

  const delta = currentKg != null && startKg != null ? currentKg - startKg : 0;
  const deltaPositive = delta > 0.05;
  const deltaNegative = delta < -0.05;
  const DeltaIcon = deltaNegative ? TrendingDown : deltaPositive ? TrendingUp : Minus;
  const deltaPillClass = deltaNegative
    ? "bg-[color:var(--recovery-high)]/15 text-[color:var(--recovery-high)]"
    : deltaPositive
      ? "bg-[color:var(--recovery-low)]/15 text-[color:var(--recovery-low)]"
      : "bg-muted text-muted-foreground";

  // Marker dot at the current progress angle.
  const theta = -Math.PI / 2 + (2 * Math.PI * pct) / 100;
  const markerX = cx + r * Math.cos(theta);
  const markerY = cy + r * Math.sin(theta);

  // Tick marks at 0, 25, 50, 75 (skip 100 since it coincides with 0).
  const ticks = [0, 25, 50, 75].map((p) => {
    const a = -Math.PI / 2 + (2 * Math.PI * p) / 100;
    const inner = r - stroke / 2 - 4;
    const outer = r + stroke / 2 + 4;
    return {
      p,
      x1: cx + inner * Math.cos(a),
      y1: cy + inner * Math.sin(a),
      x2: cx + outer * Math.cos(a),
      y2: cy + outer * Math.sin(a),
    };
  });

  const displayCurrent = toDisplay(currentKg, unit);

  return (
    <div className="relative flex items-center justify-center w-full max-w-[280px] aspect-square mx-auto">
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--recovery-high)" />
          </linearGradient>
          <radialGradient id="markerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--recovery-high)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--recovery-high)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Tick marks */}
        <g stroke="var(--border)" strokeWidth={1.5} strokeLinecap="round">
          {ticks.map((t) => (
            <line key={t.p} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
          ))}
        </g>

        {/* Inner shadow track for depth */}
        <circle cx={cx} cy={cy} r={r - stroke / 2 - 2} fill="none" stroke="var(--border)" strokeWidth={1} opacity={0.5} />

        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} opacity={0.5} />

        {/* Progress arc */}
        <g transform={`rotate(-90 ${cx} ${cy})`}>
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
        </g>

        {/* Marker dot with glow */}
        {pct > 0 && pct < 100 && (
          <g className="transition-all duration-700 ease-out">
            <circle cx={markerX} cy={markerY} r={14} fill="url(#markerGlow)" />
            <circle cx={markerX} cy={markerY} r={5} fill="var(--background)" stroke="var(--recovery-high)" strokeWidth={2.5} />
          </g>
        )}
      </svg>

      {/* Silhouette behind the readout */}
      <svg
        viewBox="0 0 100 200"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 m-auto text-foreground opacity-[0.07] transition-transform duration-700 ease-out"
        style={{
          width: "50%",
          height: "78%",
          transform: `scale(${widthScale}, ${heightScale})`,
          transformOrigin: "center",
        }}
        aria-hidden
      >
        {/* Head */}
        <circle cx="50" cy="22" r="11" fill="currentColor" />
        {/* Neck + shoulders + torso */}
        <path
          fill="currentColor"
          d="M44 34 Q44 39 38 41 L26 47 Q20 50 21 56 L25 92 Q26 98 32 98 L34 98 L34 110 Q34 115 36 120 L40 165 Q40 172 47 172 L48 172 L48 130 L52 130 L52 172 L53 172 Q60 172 60 165 L64 120 Q66 115 66 110 L66 98 L68 98 Q74 98 75 92 L79 56 Q80 50 74 47 L62 41 Q56 39 56 34 Z"
        />
        {/* Legs taper */}
        <path
          fill="currentColor"
          d="M40 172 L42 192 Q42 196 46 196 L48 196 Q50 196 50 192 L50 172 Z M50 172 L50 192 Q50 196 52 196 L54 196 Q58 196 58 192 L60 172 Z"
        />
      </svg>

      {/* Center readout */}
      <div className="relative z-10 text-center px-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">Current</div>
        <div className="mt-0.5 flex items-baseline justify-center gap-1.5">
          <span className="text-5xl font-semibold tabular-nums leading-none">
            {displayCurrent != null ? displayCurrent.toFixed(1) : "—"}
          </span>
          <span className="text-sm text-muted-foreground font-medium">{unitLabel(unit)}</span>
        </div>
        {currentKg != null && startKg != null && (delta !== 0) && (
          <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium tabular-nums ${deltaPillClass}`}>
            <DeltaIcon className="size-3" />
            {fmtDelta(delta, unit, 1)}
          </div>
        )}
        {goalKg != null && (
          <div className="mt-2 text-[11px] text-muted-foreground tabular-nums">
            {pct.toFixed(0)}% to {fmtWeight(goalKg, unit, 1)}
          </div>
        )}
      </div>
    </div>
  );
}
