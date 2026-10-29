import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarRange } from "lucide-react";
import type { DayNote, WeeklySummary } from "@/lib/weekly-summary";

function range(s: WeeklySummary) {
  const f = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  return `${f(s.start)} – ${f(s.end)}`;
}

export function WeeklySummaryCard({ data, loading }: { data: WeeklySummary | null; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><CalendarRange className="size-4" /> Your week</CardTitle>
        <CardDescription>{data ? `${range(data)} · compared with the 7 days before` : "Last 7 days compared with the 7 before"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Putting your week together…</p>}
        {data && (
          <>
            <p className="text-base font-medium leading-snug">{data.headline}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
              {data.metrics.filter((m) => m.thisWeek != null).map((m) => (
                <div key={m.key}>
                  <div className="text-xs text-muted-foreground">{m.label}</div>
                  <div className="text-lg font-semibold tabular-nums">{m.thisText}</div>
                  {m.deltaText && (
                    <div className={`text-xs tabular-nums ${m.better === true ? "text-[color:var(--recovery-high)]" : m.better === false ? "text-[color:var(--recovery-low)]" : "text-muted-foreground"}`}>
                      {m.deltaText} vs last week
                    </div>
                  )}
                </div>
              ))}
            </div>

            {(data.best || data.worst) && (
              <div className="grid sm:grid-cols-2 gap-3">
                {data.best && <DayBox title="Best day" day={data.best} />}
                {data.worst && <DayBox title="Toughest day" day={data.worst} />}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Logged this week: {data.logging.eveningCheckIns}/{data.logging.days} evening check-ins · {data.logging.mealDays}/{data.logging.days} days of meals
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DayBox({ title, day }: { title: string; day: DayNote }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-sm font-medium mt-0.5">{day.dayLabel} · {day.recovery}% recovery</div>
      {day.notes.length > 0 && <div className="text-xs text-muted-foreground mt-1">{day.notes.join(" · ")}</div>}
    </div>
  );
}
