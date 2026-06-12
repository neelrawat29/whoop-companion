import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo } from "react";
import { Flame, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
});

type Entry = { entry_date: string; recovery: number | null; hrv: number | null; rhr: number | null; sleep_hours: number | null };
type Habit = { entry_date: string; drinks: number | null; supplements: string[] | null; cool_room: boolean | null; work_location: string | null };

function avg(nums: number[]) { return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null; }

function InsightsPage() {
  const { data: entries } = useQuery({
    queryKey: ["insights-entries"],
    queryFn: async () => {
      const { data } = await supabase.from("daily_entries").select("entry_date,recovery,hrv,rhr,sleep_hours").order("entry_date").limit(90);
      return (data ?? []) as Entry[];
    },
  });

  const { data: habits } = useQuery({
    queryKey: ["insights-habits"],
    queryFn: async () => {
      const { data } = await supabase.from("habits_log").select("entry_date,drinks,supplements,cool_room").order("entry_date").limit(90);
      return (data ?? []) as Habit[];
    },
  });

  const stats = useMemo(() => {
    if (!entries) return null;
    const recoveries = entries.map((e) => e.recovery).filter((v): v is number => v != null);
    const last7 = recoveries.slice(-7);
    const last30 = recoveries.slice(-30);
    return {
      avg7: avg(last7),
      avg30: avg(last30),
      avgAll: avg(recoveries),
      total: entries.length,
    };
  }, [entries]);

  const streak = useMemo(() => {
    if (!entries) return 0;
    let s = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
      if ((entries[i].recovery ?? 0) >= 67) s++;
      else break;
    }
    return s;
  }, [entries]);

  const correlations = useMemo(() => {
    if (!entries || !habits) return [];
    const map = new Map(entries.map((e) => [e.entry_date, e.recovery]));
    const result: { label: string; withAvg: number; withoutAvg: number; delta: number; n: number }[] = [];

    const buckets = {
      "After alcohol (1+ drink)": (h: Habit) => (h.drinks ?? 0) >= 1,
      "Cool room": (h: Habit) => !!h.cool_room,
    };

    for (const [label, pred] of Object.entries(buckets)) {
      const withR: number[] = [];
      const withoutR: number[] = [];
      for (const h of habits) {
        const r = map.get(h.entry_date);
        if (r == null) continue;
        if (pred(h)) withR.push(r); else withoutR.push(r);
      }
      if (withR.length >= 3 && withoutR.length >= 3) {
        const wa = avg(withR)!;
        const woa = avg(withoutR)!;
        result.push({ label, withAvg: wa, withoutAvg: woa, delta: wa - woa, n: withR.length + withoutR.length });
      }
    }

    // Supplements
    const suppCounts = new Map<string, { withR: number[]; withoutR: number[] }>();
    for (const h of habits) {
      const r = map.get(h.entry_date);
      if (r == null) continue;
      const taken = new Set(h.supplements ?? []);
      // collect all unique supplements across history
      for (const s of taken) {
        if (!suppCounts.has(s)) suppCounts.set(s, { withR: [], withoutR: [] });
      }
    }
    for (const [name, bucket] of suppCounts) {
      for (const h of habits) {
        const r = map.get(h.entry_date);
        if (r == null) continue;
        if ((h.supplements ?? []).includes(name)) bucket.withR.push(r);
        else bucket.withoutR.push(r);
      }
      if (bucket.withR.length >= 3 && bucket.withoutR.length >= 3) {
        const wa = avg(bucket.withR)!;
        const woa = avg(bucket.withoutR)!;
        result.push({ label: `Took ${name}`, withAvg: wa, withoutAvg: woa, delta: wa - woa, n: bucket.withR.length + bucket.withoutR.length });
      }
    }

    return result.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [entries, habits]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
        <p className="text-muted-foreground text-sm">Trends and what's driving your recovery.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="7-day avg" value={stats?.avg7 != null ? `${stats.avg7.toFixed(0)}%` : "—"} />
        <StatCard label="30-day avg" value={stats?.avg30 != null ? `${stats.avg30.toFixed(0)}%` : "—"} />
        <StatCard label="All-time avg" value={stats?.avgAll != null ? `${stats.avgAll.toFixed(0)}%` : "—"} />
        <StatCard label="Green streak" value={`${streak}d`} icon={Flame} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recovery trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={entries ?? []}>
                <XAxis dataKey="entry_date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="recovery" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="size-4" /> Habit correlations</CardTitle>
          <CardDescription>Avg recovery on days with vs without each habit. Needs at least 3 days each side.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {correlations.length === 0 && <p className="text-sm text-muted-foreground">Log a few weeks of data to see correlations.</p>}
          {correlations.map((c) => (
            <div key={c.label} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
              <div>
                <div className="font-medium text-sm">{c.label}</div>
                <div className="text-xs text-muted-foreground">
                  {c.withAvg.toFixed(0)}% with vs {c.withoutAvg.toFixed(0)}% without · {c.n} days
                </div>
              </div>
              <div className={`text-lg font-semibold ${c.delta >= 0 ? "text-[color:var(--recovery-high)]" : "text-[color:var(--recovery-low)]"}`}>
                {c.delta > 0 ? "+" : ""}{c.delta.toFixed(0)} pts
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1">{Icon && <Icon className="size-3" />}{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
