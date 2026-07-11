import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo } from "react";
import { ChevronRight, Flame, Sparkles, TrendingUp, CalendarDays } from "lucide-react";


export const Route = createFileRoute("/_authenticated/insights/")({
  component: InsightsPage,
});

type Entry = { entry_date: string; recovery: number | null; hrv: number | null; rhr: number | null; sleep_hours: number | null };
type Habit = { entry_date: string; drinks: number | null; supplements: string[] | null; cool_room: boolean | null; work_location: string | null };

function avg(nums: number[]) { return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null; }

function InsightsPage() {
  const { data: entries } = useQuery({
    queryKey: ["insights-entries"],
    queryFn: async () => {
      const { data } = await supabase.from("daily_entries").select("entry_date,recovery,hrv,rhr,sleep_hours").order("entry_date", { ascending: false }).limit(90);
      return ((data ?? []) as Entry[]).reverse();
    },
  });

  const { data: habits } = useQuery({
    queryKey: ["insights-habits"],
    queryFn: async () => {
      const { data } = await supabase.from("habits_log").select("entry_date,drinks,supplements,cool_room,work_location").order("entry_date", { ascending: false }).limit(90);
      return ((data ?? []) as Habit[]).reverse();
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

  const dowStats = useMemo(() => {
    if (!entries) return [];
    const buckets: { sum: number; n: number }[] = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
    for (const e of entries) {
      if (e.recovery == null) continue;
      const d = new Date(e.entry_date + "T00:00:00Z");
      const dow = d.getUTCDay();
      buckets[dow].sum += e.recovery;
      buckets[dow].n += 1;
    }
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    // reorder Mon..Sun for nicer week feel
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((i) => ({
      day: labels[i],
      avg: buckets[i].n ? Math.round(buckets[i].sum / buckets[i].n) : null,
      n: buckets[i].n,
    }));
  }, [entries]);

  const bestWorstDow = useMemo(() => {
    const vals = dowStats.filter((d): d is { day: string; avg: number; n: number } => d.avg != null && d.n >= 2);
    if (vals.length < 2) return null;
    const best = vals.reduce((a, b) => (b.avg > a.avg ? b : a));
    const worst = vals.reduce((a, b) => (b.avg < a.avg ? b : a));
    return { best, worst };
  }, [dowStats]);

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

    // Work location: Home vs Office
    const homeR: number[] = [];
    const officeR: number[] = [];
    for (const h of habits) {
      const r = map.get(h.entry_date);
      if (r == null) continue;
      if (h.work_location === "home") homeR.push(r);
      else if (h.work_location === "office") officeR.push(r);
    }
    if (homeR.length >= 3 && officeR.length >= 3) {
      const wa = avg(homeR)!;
      const woa = avg(officeR)!;
      result.push({ label: "Worked from home (vs office)", withAvg: wa, withoutAvg: woa, delta: wa - woa, n: homeR.length + officeR.length });
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
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Insights</h1>
        <p className="text-muted-foreground text-sm">Trends and what's driving your recovery.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="7-day avg" value={stats?.avg7 != null ? `${stats.avg7.toFixed(0)}%` : "—"} />
        <StatCard label="30-day avg" value={stats?.avg30 != null ? `${stats.avg30.toFixed(0)}%` : "—"} />
        <StatCard label="All-time avg" value={stats?.avgAll != null ? `${stats.avgAll.toFixed(0)}%` : "—"} />
        <StatCard label="Green streak" value={`${streak}d`} icon={Flame} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Link to="/insights/biological-age" className="block">
          <Card className="transition-colors hover:border-primary/40 h-full">
            <CardContent className="py-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center">
                <Sparkles className="size-5" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Biological Age</div>
                <div className="text-xs text-muted-foreground">See how your body is reading vs your chronological age.</div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/insights/trends" className="block">
          <Card className="transition-colors hover:border-primary/40 h-full">
            <CardContent className="py-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center">
                <TrendingUp className="size-5" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Trends</div>
                <div className="text-xs text-muted-foreground">7 / 30 / 90-day charts across every metric.</div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
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
          <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="size-4" /> Recovery by day of week</CardTitle>
          <CardDescription>
            {bestWorstDow
              ? `Best: ${bestWorstDow.best.day} (${bestWorstDow.best.avg}%) · Worst: ${bestWorstDow.worst.day} (${bestWorstDow.worst.avg}%)`
              : "Log a few more days to see your weekly pattern."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dowStats.map((d) => ({ ...d, avg: d.avg ?? 0 }))}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                  {dowStats.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.avg == null
                          ? "hsl(var(--muted))"
                          : d.avg >= 67
                            ? "var(--recovery-high)"
                            : d.avg >= 34
                              ? "var(--recovery-mid)"
                              : "var(--recovery-low)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
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
