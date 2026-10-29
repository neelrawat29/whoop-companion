import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { OUTCOME_LABELS, type Confidence, type HabitInsights } from "@/lib/habit-insights";

const CONFIDENCE: Record<Confidence, { label: string; hint: string; className: string }> = {
  consistent: { label: "Consistent", hint: "Clear and repeated across many nights", className: "bg-foreground text-background" },
  likely: { label: "Likely", hint: "Shows up fairly reliably so far", className: "bg-muted text-foreground border border-border" },
  early: { label: "Early sign", hint: "Few nights so far — could be chance", className: "text-muted-foreground border border-dashed border-border" },
};

export function HabitFindingsCard({ data, loading }: { data: HabitInsights | null; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Lightbulb className="size-4" /> What affects your next morning</CardTitle>
        <CardDescription>
          Each habit is compared with your recovery, HRV, resting heart rate and sleep the following morning
          {data ? `, over the last ${data.windowDays} days (${data.pairedNights} matched nights)` : ""}. These are patterns, not proof of cause.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Looking for patterns…</p>}
        {!loading && data && data.findings.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {data.noClearLink.length
              ? "No clear patterns yet. Keep logging your evening check-ins and they'll show up here."
              : "Log evening check-ins (drinks, caffeine, last meal, water) for a couple of weeks to see what affects your recovery."}
          </p>
        )}
        {data?.findings.map((f) => {
          const c = CONFIDENCE[f.primary.confidence];
          return (
            <div key={f.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium text-sm">{f.label}</div>
                <div className="flex items-center gap-2 shrink-0">
                  {f.primary.notable && (
                    <span className={`text-sm font-semibold tabular-nums ${f.primary.better ? "text-[color:var(--recovery-high)]" : "text-[color:var(--recovery-low)]"}`}>
                      {f.primary.deltaText} {OUTCOME_LABELS[f.primary.outcome].toLowerCase()}
                    </span>
                  )}
                  <span title={c.hint} className={`text-[10px] font-medium uppercase tracking-wide rounded-full px-2 py-0.5 ${c.className}`}>{c.label}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{f.sentence}</p>
              <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                {f.primary.nWith} nights with · {f.primary.nWithout} without
                {f.also.length > 0 && (
                  <> · Also: {f.also.map((e) => `${OUTCOME_LABELS[e.outcome]} ${e.deltaText}`).join(", ")}</>
                )}
              </p>
            </div>
          );
        })}
        {data && data.noClearLink.length > 0 && (
          <p className="text-xs text-muted-foreground pt-1">
            <span className="font-medium text-foreground">No clear link yet:</span> {data.noClearLink.join(", ")}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
