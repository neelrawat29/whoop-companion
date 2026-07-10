import { Card, CardContent } from "@/components/ui/card";
import { Flame, Beef, Moon } from "lucide-react";

interface RingProps {
  label: string;
  value: number;
  target: number;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function Ring({ label, value, target, unit, icon: Icon, color }: RingProps) {
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const remaining = Math.max(0, Math.round(target - value));
  const size = 96;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--border))" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <Icon className="size-5" style={{ color }} />
        </div>
      </div>
      <div className="text-center">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold tabular-nums">
          {Math.round(value)}
          <span className="text-muted-foreground font-normal"> / {Math.round(target)} {unit}</span>
        </div>
        <div className="text-[10px] text-muted-foreground tabular-nums">
          {remaining > 0 ? `${remaining} ${unit} left` : "Target hit"}
        </div>
      </div>
    </div>
  );
}

export interface DailyRingsProps {
  kcal: number;
  protein_g: number;
  sleep_hours: number;
  kcalTarget: number | null | undefined;
  proteinTarget: number | null | undefined;
  sleepTarget: number | null | undefined;
}

export function DailyRings({ kcal, protein_g, sleep_hours, kcalTarget, proteinTarget, sleepTarget }: DailyRingsProps) {
  if (!kcalTarget && !proteinTarget && !sleepTarget) return null;
  return (
    <Card>
      <CardContent className="py-5">
        <div className="grid grid-cols-3 gap-4">
          <Ring label="Calories" value={kcal} target={kcalTarget ?? 2000} unit="kcal" icon={Flame} color="hsl(var(--primary))" />
          <Ring label="Protein" value={protein_g} target={proteinTarget ?? 120} unit="g" icon={Beef} color="hsl(20 80% 55%)" />
          <Ring label="Sleep" value={sleep_hours} target={sleepTarget ?? 8} unit="h" icon={Moon} color="hsl(220 70% 55%)" />
        </div>
      </CardContent>
    </Card>
  );
}
