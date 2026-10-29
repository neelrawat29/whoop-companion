import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity } from "lucide-react";
import type { Baselines, MetricBaseline } from "@/lib/baselines";

const STATUS_TEXT = { below: "Below usual", within: "Usual", above: "Above usual" } as const;

export function BaselinesCard({ data, loading }: { data: Baselines | null; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Activity className="size-4" /> Compared with your normal</CardTitle>
        <CardDescription>
          Shaded band = your usual range, based on the {data?.windowDays ?? 30} days before each day. HRV and resting heart rate vary a lot between people, so your own range matters more than the raw number.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading && <p className="text-sm text-muted-foreground">Working out your usual ranges…</p>}
        {data?.metrics.map((m) => <MetricRow key={m.metric} m={m} />)}
      </CardContent>
    </Card>
  );
}

function MetricRow({ m }: { m: MetricBaseline }) {
  const statusClass = m.status == null
    ? ""
    : m.concerning
      ? "text-[color:var(--recovery-low)] border-[color:var(--recovery-low)]/40"
      : "text-muted-foreground border-border";
  const fmt = (v: number) => (m.metric === "sleep_hours" ? `${Math.floor(v)}h ${Math.round((v % 1) * 60)}m` : `${Math.round(v)} ${m.unit}`);
  const series = m.series.map((p) => ({ ...p, band: p.low != null && p.high != null ? [p.low, p.high] : null }));

  return (
    <div className="border-b border-border pb-4 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs text-muted-foreground">{m.label}</div>
          <div className="text-xl font-semibold tabular-nums">
            {m.latest?.text ?? "—"}
            {m.latest && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                {new Date(m.latest.date + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}
              </span>
            )}
          </div>
        </div>
        {m.status && (
          <span className={`text-[11px] font-medium rounded-full border px-2 py-0.5 ${statusClass}`}>{STATUS_TEXT[m.status]}</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        {m.summary}
        {m.range && <> Usual: {m.range.text}.</>}
      </p>
      {series.length > 1 && (
        <div className="h-28 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
              <YAxis tick={{ fontSize: 10 }} width={32} domain={["auto", "auto"]} />
              <Tooltip
                formatter={(v: number | number[], name: string) =>
                  Array.isArray(v) ? [`${fmt(v[0])} – ${fmt(v[1])}`, "Usual range"] : [fmt(v), name === "value" ? m.label : name]}
                labelStyle={{ fontSize: 11 }}
              />
              <Area dataKey="band" stroke="none" fill="var(--muted-foreground)" fillOpacity={0.15} connectNulls isAnimationActive={false} />
              <Line dataKey="value" stroke="var(--foreground)" strokeWidth={1.75} dot={{ r: 2 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
