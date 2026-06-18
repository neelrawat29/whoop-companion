import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { movingAverage, toDisplay, unitLabel, type WeightEntry, type WeightUnit } from "@/lib/weight";

type Props = {
  entries: WeightEntry[]; // asc by date
  goalKg: number | null;
  unit: WeightUnit;
};

export function WeightChart({ entries, goalKg, unit }: Props) {
  const data = useMemo(() => {
    const ma = movingAverage(entries, 7);
    return entries.map((e, i) => ({
      date: e.entry_date,
      raw: toDisplay(e.weight_kg, unit),
      ma: ma[i] != null ? toDisplay(ma[i] as number, unit) : null,
    }));
  }, [entries, unit]);

  const goalDisplay = goalKg != null ? toDisplay(goalKg, unit) : null;

  if (entries.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
        Log a few entries to see your trend.
      </div>
    );
  }

  return (
    <div className="h-[280px] -ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v: string) => {
              const [, m, d] = v.split("-");
              return `${m}/${d}`;
            }}
            minTickGap={24}
            stroke="var(--border)"
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            width={42}
            stroke="var(--border)"
            tickFormatter={(v: number) => v.toFixed(0)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => v}
            formatter={(value: any, name: any) => {
              if (value == null) return ["—", name];
              const label = name === "ma" ? "7-day avg" : "Weight";
              return [`${Number(value).toFixed(1)} ${unitLabel(unit)}`, label];
            }}
          />
          <Area
            type="monotone"
            dataKey="ma"
            stroke="none"
            fill="url(#weightArea)"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="raw"
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            strokeOpacity={0.5}
            dot={{ r: 2, fill: "var(--muted-foreground)" }}
            activeDot={{ r: 4 }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="ma"
            stroke="var(--primary)"
            strokeWidth={2.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          {goalDisplay != null && (
            <ReferenceLine
              y={goalDisplay}
              stroke="var(--recovery-high)"
              strokeDasharray="4 4"
              label={{
                value: `Goal ${goalDisplay.toFixed(1)} ${unitLabel(unit)}`,
                position: "insideTopRight",
                fill: "var(--recovery-high)",
                fontSize: 11,
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
