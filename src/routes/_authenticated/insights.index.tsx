import { covePageHead } from "@/lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Flame, Sparkles, TrendingUp, CalendarDays } from "lucide-react";
import { HabitFindingsCard } from "@/components/insights/HabitFindingsCard";
import { loadHabitInsights, type HabitFinding } from "@/lib/habit-insights";
import { habitPinSource, loadPins, pinFinding, refreshPins, stalePins, unpin } from "@/lib/pinned-insights";
import { BaselinesCard } from "@/components/insights/BaselinesCard";
import { loadBaselines } from "@/lib/baselines";
import { WeeklySummaryCard } from "@/components/insights/WeeklySummaryCard";
import { loadWeeklySummary } from "@/lib/weekly-summary";
import { today as appToday } from "@/lib/recovery";

export const Route = createFileRoute("/_authenticated/insights/")({
  head: () => covePageHead("Insights", "Explore recovery and sleep patterns in Cove."),
  component: InsightsPage,
});

type Entry = { entry_date: string; recovery: number | null; hrv: number | null; rhr: number | null; sleep_hours: number | null };
type Habit = { entry_date: string; strain: number | null };

function avg(nums: number[]) { return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null; }

type MetricKey = "recovery" | "sleep" | "strain";

const METRICS: Record<MetricKey, {
  label: string;
  unit: string;
  color: string;
  domain: [number, number];
  fmt: (v: number) => string;
  fromEntry?: (e: Entry) => number | null;
  fromHabit?: (h: Habit) => number | null;
}> = {
  recovery: {
    label: "Recovery",
    unit: "%",
    color: "var(--primary)",
    domain: [0, 100],
    fmt: (v) => `${v.toFixed(0)}%`,
    fromEntry: (e) => e.recovery,
  },
  sleep: {
    label: "Sleep",
    unit: "h",
    color: "hsl(220 70% 55%)",
    domain: [0, 12],
    fmt: (v) => {
      const h = Math.floor(v);
      const m = Math.round((v - h) * 60);
      return `${h} hr ${m} min`;
    },
    fromEntry: (e) => e.sleep_hours,
  },
  strain: {
    label: "Strain",
    unit: "",
    color: "hsl(20 80% 55%)",
    domain: [0, 21],
    fmt: (v) => v.toFixed(1),
    fromHabit: (h) => h.strain,
  },
};

const METRIC_ORDER: MetricKey[] = ["recovery", "sleep", "strain"];

function InsightsPage() {
  const [metric, setMetric] = useState<MetricKey>("recovery");
  const cfg = METRICS[metric];

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
      const { data } = await supabase.from("habits_log").select("entry_date,strain").order("entry_date", { ascending: false }).limit(90);
      return ((data ?? []) as Habit[]).reverse();
    },
  });

  // Unified daily series for the selected metric: [{ entry_date, value }]
  const series = useMemo(() => {
    const source = cfg.fromEntry ? entries : habits;
    if (!source) return [];
    return source
      .map((row) => ({ entry_date: row.entry_date, value: (cfg.fromEntry ? cfg.fromEntry(row as Entry) : cfg.fromHabit!(row as Habit)) }))
      .filter((p): p is { entry_date: string; value: number } => p.value != null);
  }, [entries, habits, cfg]);

  const stats = useMemo(() => {
    if (!series.length) return null;
    const values = series.map((p) => p.value);
    return {
      avg7: avg(values.slice(-7)),
      avg30: avg(values.slice(-30)),
      avgAll: avg(values),
      days: values.length,
    };
  }, [series]);

  const streak = useMemo(() => {
    if (!entries) return 0;
    let s = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
      if ((entries[i].recovery ?? 0) >= 67) s++;
      else break;
    }
    return s;
  }, [entries]);

  const [selectedDow, setSelectedDow] = useState<string | null>(null);

  const dowSeries = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return series.filter((p) => p.entry_date >= cutoffStr);
  }, [series]);

  const dowStats = useMemo(() => {
    const buckets: { sum: number; n: number }[] = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
    for (const p of dowSeries) {
      const d = new Date(p.entry_date + "T00:00:00Z");
      const dow = d.getUTCDay();
      buckets[dow].sum += p.value;
      buckets[dow].n += 1;
    }
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((i) => ({
      day: labels[i],
      avg: buckets[i].n ? buckets[i].sum / buckets[i].n : null,
      n: buckets[i].n,
    }));
  }, [dowSeries]);

  const selectedDowEntries = useMemo(() => {
    if (!selectedDow) return [];
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dow = labels.indexOf(selectedDow);
    return dowSeries
      .filter((p) => new Date(p.entry_date + "T00:00:00Z").getUTCDay() === dow)
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  }, [dowSeries, selectedDow]);

  const bestWorstDow = useMemo(() => {
    const vals = dowStats.filter((d): d is { day: string; avg: number; n: number } => d.avg != null && d.n >= 2);
    if (vals.length < 2) return null;
    const best = vals.reduce((a, b) => (b.avg > a.avg ? b : a));
    const worst = vals.reduce((a, b) => (b.avg < a.avg ? b : a));
    return { best, worst };
  }, [dowStats]);

  const { data: weekly, isLoading: weeklyLoading } = useQuery({
    queryKey: ["weekly-summary"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const today = appToday();
      return loadWeeklySummary(supabase, u.user.id, today);
    },
  });

  const { data: baselines, isLoading: baselinesLoading } = useQuery({
    queryKey: ["baselines"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const today = appToday();
      return loadBaselines(supabase, u.user.id, today);
    },
  });

  const { data: habitInsights, isLoading: habitLoading } = useQuery({
    queryKey: ["habit-insights"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      return loadHabitInsights(supabase, u.user.id);
    },
  });

  const { data: pins } = useQuery({ queryKey: ["pinned-insights"], queryFn: () => loadPins(supabase) });
  const pinnedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of habitInsights?.findings ?? []) if (pins?.some((p) => p.source === habitPinSource(f.id))) ids.add(f.id);
    return ids;
  }, [pins, habitInsights]);

  const togglePin = useMutation({
    mutationFn: async ({ f, pinned }: { f: HabitFinding; pinned: boolean }) => {
      if (pinned) {
        const pin = pins?.find((p) => p.source === habitPinSource(f.id));
        if (pin) await unpin(supabase, pin.id);
      } else {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error("Not signed in");
        await pinFinding(supabase, u.user.id, f);
      }
      return pinned;
    },
    onSuccess: (wasPinned) => toast.success(wasPinned ? "Unpinned from Today" : "Pinned to Today"),
    onError: () => toast.error("Couldn't update pin. Try again."),
  });

  // Keep pinned text in step with the latest analysis so Today never shows old numbers.
  const syncPins = useMutation({ mutationFn: (u: { id: string; content: string }[]) => refreshPins(supabase, u) });
  const stale = useMemo(() => (pins && habitInsights ? stalePins(pins, habitInsights.findings) : []), [pins, habitInsights]);
  useEffect(() => {
    if (stale.length && !syncPins.isPending) syncPins.mutate(stale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Insights</h1>
          <p className="text-muted-foreground text-sm">Trends and what's driving your {cfg.label.toLowerCase()}.</p>
        </div>
        <div className="inline-flex rounded-full bg-muted p-1" role="group" aria-label="Metric">
          {METRIC_ORDER.map((m) => (
            <Button
              key={m}
              size="sm"
              variant={m === metric ? "default" : "ghost"}
              onClick={() => setMetric(m)}
              className="rounded-full h-8 px-4 text-xs"
            >
              {METRICS[m].label}
            </Button>
          ))}
        </div>
      </div>

      <WeeklySummaryCard data={weekly ?? null} loading={weeklyLoading} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={`Avg ${cfg.label.toLowerCase()} · 7 days`} value={stats?.avg7 != null ? cfg.fmt(stats.avg7) : "—"} />
        <StatCard label={`Avg ${cfg.label.toLowerCase()} · 30 days`} value={stats?.avg30 != null ? cfg.fmt(stats.avg30) : "—"} />
        <StatCard label={`Avg ${cfg.label.toLowerCase()} · all time`} value={stats?.avgAll != null ? cfg.fmt(stats.avgAll) : "—"} />
        {metric === "recovery" ? (
          <StatCard label="Green streak (recovery ≥ 67%)" value={`${streak}d`} icon={Flame} />
        ) : (
          <StatCard label={`Days with ${cfg.label.toLowerCase()} data`} value={stats ? `${stats.days}d` : "—"} />
        )}
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

      <BaselinesCard data={baselines ?? null} loading={baselinesLoading} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{cfg.label} trend</CardTitle>
          <CardDescription>Daily {cfg.label.toLowerCase()} over your logged days.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <XAxis dataKey="entry_date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis domain={cfg.domain} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number | string) => (typeof v === "number" ? cfg.fmt(v) : v)} />
                <Line type="monotone" dataKey="value" stroke={cfg.color} strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="size-4" /> {cfg.label} by day of week</CardTitle>
          <CardDescription>
            Average for each weekday over the last 28 days.
            {bestWorstDow
              ? ` Best: ${bestWorstDow.best.day} (${cfg.fmt(bestWorstDow.best.avg)}) · Worst: ${bestWorstDow.worst.day} (${cfg.fmt(bestWorstDow.worst.avg)})`
              : " Log a few more days to see your weekly pattern."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dowStats.map((d) => ({ ...d, avg: d.avg ?? 0 }))}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis domain={cfg.domain} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number | string) => (typeof v === "number" ? cfg.fmt(v) : v)} />
                <Bar
                  dataKey="avg"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={(data: { day?: string }) => {
                    if (data?.day) setSelectedDow((prev) => (prev === data.day ? null : data.day!));
                  }}
                >
                  {dowStats.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.avg == null
                          ? "var(--muted)"
                          : metric === "recovery"
                            ? d.avg >= 67
                              ? "var(--recovery-high)"
                              : d.avg >= 34
                                ? "var(--recovery-mid)"
                                : "var(--recovery-low)"
                            : cfg.color
                      }
                      fillOpacity={selectedDow == null ? 1 : d.day === selectedDow ? 1 : 0.25}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {selectedDow && (
            <div className="mt-4 border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">
                  {cfg.label} on {selectedDow} — {selectedDowEntries.length} {selectedDowEntries.length === 1 ? "entry" : "entries"}
                </p>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelectedDow(null)}>
                  Clear selection
                </Button>
              </div>
              {selectedDowEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries for this day in the last 28 days.</p>
              ) : (
                <ul className="space-y-1.5">
                  {selectedDowEntries.map((p) => (
                    <li key={p.entry_date} className="flex items-center justify-between text-sm">
                      <Link to="/log" className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                        {new Date(p.entry_date + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      </Link>
                      <span className="font-medium">{cfg.fmt(p.value)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <HabitFindingsCard
        data={habitInsights ?? null}
        loading={habitLoading}
        pinnedIds={pinnedIds}
        onTogglePin={(f, pinned) => togglePin.mutate({ f, pinned })}
        pinBusy={togglePin.isPending}
      />
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
