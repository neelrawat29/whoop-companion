import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getMyTrends, type TrendRange } from "@/lib/trends.functions";

export const Route = createFileRoute("/_authenticated/insights/trends")({
  component: TrendsPage,
});

const RANGES: TrendRange[] = [7, 30, 90];

const METRICS: Array<{ key: "recovery" | "hrv" | "sleep_hours" | "kcal" | "protein_g" | "weight_kg"; label: string; color: string; unit?: string }> = [
  { key: "recovery", label: "Recovery", color: "hsl(var(--primary))", unit: "%" },
  { key: "hrv", label: "HRV", color: "hsl(160 70% 45%)", unit: "ms" },
  { key: "sleep_hours", label: "Sleep", color: "hsl(220 70% 55%)", unit: "h" },
  { key: "kcal", label: "Calories", color: "hsl(20 80% 55%)", unit: "kcal" },
  { key: "protein_g", label: "Protein", color: "hsl(340 70% 55%)", unit: "g" },
  { key: "weight_kg", label: "Weight", color: "hsl(280 60% 55%)", unit: "kg" },
];

function TrendsPage() {
  const [range, setRange] = useState<TrendRange>(30);
  const fetchTrends = useServerFn(getMyTrends);
  const { data } = useQuery({
    queryKey: ["trends", range],
    queryFn: () => fetchTrends({ data: { range } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Trends</h1>
          <p className="text-muted-foreground text-sm">See how the last {range} days are moving.</p>
        </div>
        <div className="inline-flex rounded-full bg-muted p-1">
          {RANGES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={r === range ? "default" : "ghost"}
              onClick={() => setRange(r)}
              className="rounded-full h-8 px-4 text-xs"
            >
              {r}d
            </Button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {METRICS.map((m) => {
          const points = data?.points ?? [];
          const avg = data?.averages?.[m.key];
          return (
            <Card key={m.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{m.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    avg {avg != null ? `${avg}${m.unit ? ` ${m.unit}` : ""}` : "—"}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">Last {range} days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} minTickGap={20} />
                      <YAxis tick={{ fontSize: 10 }} width={30} />
                      <Tooltip formatter={(v: number | string) => `${v}${m.unit ? ` ${m.unit}` : ""}`} labelStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
