import { useEffect, useMemo, useRef, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

type Props = {
  biological: number;
  chronological: number | null;
  delta: number | null;
};

const SIZE = 280;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
// Arc spans 240deg from -210 (bottom-left) to +30 (bottom-right)
const ARC_START = -210;
const ARC_SWEEP = 240;
const CIRC = 2 * Math.PI * RADIUS;
const ARC_LEN = (CIRC * ARC_SWEEP) / 360;
const GAP_LEN = CIRC - ARC_LEN;

function polar(angleDeg: number, r = RADIUS) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function ageToAngle(age: number, min: number, max: number) {
  const t = Math.max(0, Math.min(1, (age - min) / (max - min)));
  return ARC_START + t * ARC_SWEEP;
}

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const fn = () => setR(m.matches);
    m.addEventListener?.("change", fn);
    return () => m.removeEventListener?.("change", fn);
  }, []);
  return r;
}

export function AgeDial({ biological, chronological, delta }: Props) {
  const reduced = useReducedMotion();
  const chrono = chronological ?? biological;
  const d = delta ?? biological - chrono;
  const younger = d < -0.5;
  const older = d > 0.5;
  const same = !younger && !older;

  const { min, max } = useMemo(() => {
    const center = chrono;
    const span = Math.max(10, Math.abs(d) + 6);
    return { min: Math.max(0, Math.round(center - span)), max: Math.round(center + span) };
  }, [chrono, d]);

  const chronoAngle = ageToAngle(chrono, min, max);
  const bioAngle = ageToAngle(biological, min, max);

  // Animated displayed number
  const [display, setDisplay] = useState(reduced ? biological : chrono);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (reduced) {
      setDisplay(biological);
      return;
    }
    const from = chrono;
    const to = biological;
    const start = performance.now();
    const dur = 1200;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [biological, chrono, reduced]);

  // Delta arc sweep animation (between chrono and bio)
  const fromA = Math.min(chronoAngle, bioAngle);
  const toA = Math.max(chronoAngle, bioAngle);
  const deltaSweep = toA - fromA;
  const deltaLen = (CIRC * deltaSweep) / 360;
  // Offset so the visible part starts at fromA
  // Stroke begins at angle 0 (3 o'clock). We rotate the whole svg so ARC_START sits at start.

  const [drawn, setDrawn] = useState(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      setDrawn(1);
      return;
    }
    const start = performance.now();
    const dur = 1200;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDrawn(eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [biological, chrono, reduced]);

  const dot = polar(ARC_START + drawn * (bioAngle - ARC_START) + (1 - drawn) * (chronoAngle - ARC_START));
  // Simpler: tween dot from chrono to bio
  const dotAngle = chronoAngle + (bioAngle - chronoAngle) * drawn;
  const dotPos = polar(dotAngle);
  const chronoTick = polar(chronoAngle);
  const chronoTickInner = polar(chronoAngle, RADIUS - 10);
  const chronoTickOuter = polar(chronoAngle, RADIUS + 10);

  const color = same
    ? "hsl(var(--muted-foreground))"
    : younger
      ? "hsl(152 60% 45%)"
      : "hsl(350 75% 55%)";

  const glow = same
    ? "transparent"
    : younger
      ? "color-mix(in oklab, hsl(152 60% 45%) 25%, transparent)"
      : "color-mix(in oklab, hsl(350 75% 55%) 25%, transparent)";

  // Build the delta arc using dasharray trick on full circle, then rotate.
  // Track arc: full ARC_SWEEP of the circle starting at ARC_START.
  // We draw two strokes: a muted track for the whole arc, and a colored stroke for chrono->bio sweep.
  // Compute dashoffset to position colored stroke from fromA to fromA + deltaSweep*drawn.
  const animatedDeltaLen = (CIRC * deltaSweep * drawn) / 360;
  // Distance along circle from angle 0 to fromA
  const offsetToFrom = (CIRC * (fromA - 0)) / 360;
  // Stroke starts at angle 0 going clockwise; we want it to start at fromA.
  // strokeDashoffset shifts the dash pattern by negative amount to start later.

  return (
    <div className="relative flex items-center justify-center w-full max-w-[280px] aspect-square mx-auto">
      <div
        aria-hidden
        className="absolute inset-0 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle at center, ${glow}, transparent 60%)` }}
      />
      <svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`} className="relative">
        {/* Track arc */}
        <circle
          cx={CX}
          cy={CY}
          r={RADIUS}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${ARC_LEN} ${GAP_LEN}`}
          strokeDashoffset={-offsetToFrom + offsetToFrom /* keep */}
          transform={`rotate(${ARC_START} ${CX} ${CY})`}
          style={{ opacity: 0.5 }}
        />
        {/* Colored delta arc */}
        <circle
          cx={CX}
          cy={CY}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${animatedDeltaLen} ${CIRC}`}
          transform={`rotate(${fromA} ${CX} ${CY})`}
          style={{ transition: reduced ? "none" : "stroke 300ms" }}
        />
        {/* Chronological tick */}
        <line
          x1={chronoTickInner.x}
          y1={chronoTickInner.y}
          x2={chronoTickOuter.x}
          y2={chronoTickOuter.y}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Bio dot */}
        <circle cx={dotPos.x} cy={dotPos.y} r={10} fill={color} />
        <circle cx={dotPos.x} cy={dotPos.y} r={16} fill={color} opacity={0.25} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-6xl font-bold tabular-nums tracking-tight leading-none">
          {display.toFixed(1)}
        </div>
        <div className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
          Biological age
        </div>
        {chronological != null && (
          <div className="mt-3 text-xs text-muted-foreground">
            vs <span className="text-foreground font-medium">{chronological}</span> chronological
          </div>
        )}
        <div
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            same
              ? "bg-muted text-muted-foreground"
              : younger
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
          }`}
        >
          {younger ? <TrendingDown className="size-3.5" /> : older ? <TrendingUp className="size-3.5" /> : null}
          {same ? "On par" : `${Math.abs(d).toFixed(1)}y ${younger ? "younger" : "older"}`}
        </div>
      </div>
    </div>
  );
}
