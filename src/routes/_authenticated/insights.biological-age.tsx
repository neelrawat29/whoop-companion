import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { getBiologicalAge, getBiologicalAgeHistory, type HistoryPoint } from "@/lib/biological-age.functions";
import type { BioAgeResult } from "@/lib/biological-age";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { AgeDial } from "@/components/age-dial";
import { Reveal } from "@/components/reveal";

export const Route = createFileRoute("/_authenticated/insights/biological-age")({
  head: () => ({
    meta: [{ title: "Biological Age — Whoop Companion" }],
  }),
  validateSearch: (search: Record<string, unknown>): { demo?: boolean } => ({
    demo: search.demo === true || search.demo === "1" || search.demo === "true",
  }),
  component: BioAgePage,
  errorComponent: BioAgeError,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Not found.</p>,
});

const DEMO_RESULT: BioAgeResult = {
  ready: true,
  chronological: 34,
  biological: 30.8,
  delta: -3.2,
  confidence: 0.82,
  daysLogged: 28,
  missingInputs: [],
  domainTotals: [
    { domain: "Sleep", years: -1.4 },
    { domain: "Recovery", years: -0.9 },
    { domain: "Cardio", years: -0.6 },
    { domain: "Nutrition", years: -0.2 },
    { domain: "Body", years: 0.1 },
    { domain: "Lifestyle", years: -0.2 },
  ],
  modifiers: [
    { domain: "Sleep", label: "Consistent 7.5h+ sleep", years: -1.4 },
    { domain: "Recovery", label: "HRV trending up week-over-week", years: -0.9 },
    { domain: "Cardio", label: "5+ strain days per week", years: -0.6 },
    { domain: "Nutrition", label: "Protein target hit 24/28 days", years: -0.2 },
    { domain: "Lifestyle", label: "Late bedtime (post-midnight) 4 nights", years: 0.6 },
    { domain: "Lifestyle", label: "Alcohol 3 drinks/week average", years: 0.4 },
  ],
};

function buildDemoHistory(): HistoryPoint[] {
  const points: HistoryPoint[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const t = (89 - i) / 89;
    // wavy descent from ~33.0 to ~30.8
    const wave = Math.sin((89 - i) / 7) * 0.35;
    const trend = 33.0 - t * 2.2;
    const bio = +(trend + wave).toFixed(2);
    points.push({
      date: d.toISOString().slice(0, 10),
      biological: bio,
      chronological: 34,
      delta: +(bio - 34).toFixed(2),
    });
  }
  return points;
}

const DEMO_HISTORY = buildDemoHistory();

function BioAgeError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => reportLovableError(error, { boundary: "biological-age" }), [error]);
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Biological Age</h1>
      <p className="text-sm text-muted-foreground">Couldn't load your score. {error.message}</p>
      <Button onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
    </div>
  );
}

function BioAgePage() {
  const { demo } = Route.useSearch();
  const ageFn = useServerFn(getBiologicalAge);
  const histFn = useServerFn(getBiologicalAgeHistory);
  const { data: realResult } = useQuery({
    queryKey: ["bio-age"],
    queryFn: () => ageFn(),
    enabled: !demo,
  });
  const { data: realHistory } = useQuery({
    queryKey: ["bio-age-history"],
    queryFn: () => histFn(),
    enabled: !demo,
  });

  const result = demo ? DEMO_RESULT : realResult;
  const history = demo ? DEMO_HISTORY : realHistory;

  if (!result) {
    return <div className="text-sm text-muted-foreground">Calculating…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/insights">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" /> Insights
          </Button>
        </Link>
      </div>

      <header className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="size-5 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Biological Age</h1>
          {demo && (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              Demo data
              <Link
                to="/insights/biological-age"
                search={{ demo: undefined }}
                className="underline-offset-2 hover:underline text-[10px] uppercase tracking-wider"
              >
                Exit
              </Link>
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          How your body is reading based on your last 30 days of logs.
        </p>
      </header>

      {!result.ready ? (
        <Card>
          <CardHeader>
            <CardTitle>Not enough data yet</CardTitle>
            <CardDescription>{result.reason}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.missingInputs.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Missing: {result.missingInputs.join(", ")}
              </p>
            )}
            <Link
              to="/insights/biological-age"
              search={{ demo: true }}
              className="text-sm text-primary hover:underline"
            >
              Preview with sample data →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <Reveal>
            <HeroDial result={result} />
          </Reveal>
          <Divider />
          <Reveal delay={80}>
            <TrendChart history={history ?? []} chronological={result.chronological} delta={result.delta ?? 0} />
          </Reveal>
          <Divider />
          <Reveal delay={80}>
            <Breakdown result={result} />
          </Reveal>
          <Divider />
          <Reveal delay={80}>
            <HelpHurt result={result} />
          </Reveal>
          <Reveal delay={80}>
            <ConfidenceFooter result={result} />
          </Reveal>
        </div>
      )}
    </div>
  );
}


function Divider() {
  return (
    <div
      aria-hidden
      className="h-px w-full"
      style={{
        background:
          "linear-gradient(to right, transparent, hsl(var(--border)) 50%, transparent)",
      }}
    />
  );
}

function HeroDial({ result }: { result: NonNullable<Awaited<ReturnType<typeof getBiologicalAge>>> }) {
  const delta = result.delta ?? 0;
  const younger = delta < -0.5;
  const older = delta > 0.5;
  const caption =
    younger
      ? `Younger by ${Math.abs(delta).toFixed(1)} years over the last 30 days`
      : older
        ? `Older by ${Math.abs(delta).toFixed(1)} years over the last 30 days`
        : `On par with your chronological age`;
  if (result.biological == null) return null;
  return (
    <Card className="border-0 bg-gradient-to-b from-muted/40 to-transparent">
      <CardContent className="py-10 flex flex-col items-center gap-5">
        <AgeDial
          biological={result.biological}
          chronological={result.chronological}
          delta={result.delta}
        />
        <p className="text-sm text-muted-foreground text-center max-w-xs">{caption}</p>
      </CardContent>
    </Card>
  );
}

function TrendChart({
  history,
  chronological,
  delta,
}: {
  history: { date: string; biological: number | null }[];
  chronological: number | null;
  delta: number;
}) {
  const data = history.filter((p) => p.biological != null);
  if (data.length < 2) return null;
  const stroke = delta < -0.5 ? "hsl(152 60% 45%)" : delta > 0.5 ? "hsl(350 75% 55%)" : "hsl(var(--primary))";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Trend (90 days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="bioFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis domain={["dataMin - 2", "dataMax + 2"]} width={32} tickLine={false} axisLine={false} />
              <Tooltip
                labelFormatter={(d) => new Date(d as string).toLocaleDateString()}
                formatter={(v: number) => [v.toFixed(1), "Biological age"]}
              />
              {chronological != null && (
                <ReferenceLine y={chronological} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              )}
              <Area type="monotone" dataKey="biological" stroke={stroke} strokeWidth={2.5} fill="url(#bioFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Dashed line is your chronological age.
        </p>
      </CardContent>
    </Card>
  );
}

function Breakdown({ result }: { result: NonNullable<Awaited<ReturnType<typeof getBiologicalAge>>> }) {
  const maxAbs = Math.max(0.5, ...result.domainTotals.map((d) => Math.abs(d.years)));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contribution by domain</CardTitle>
        <CardDescription>Years added or subtracted from your chronological age.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {result.domainTotals.map((d) => {
          const pct = (Math.abs(d.years) / maxAbs) * 50;
          const younger = d.years < 0;
          return (
            <div key={d.domain} className="grid grid-cols-[100px_1fr_60px] items-center gap-3">
              <div className="text-sm font-medium">{d.domain}</div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                {d.years !== 0 && (
                  <div
                    className={`absolute inset-y-0 ${younger ? "right-1/2 bg-emerald-500" : "left-1/2 bg-rose-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
              <div className={`text-sm tabular-nums text-right ${
                d.years === 0 ? "text-muted-foreground" : d.years < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}>
                {d.years === 0 ? "—" : `${d.years > 0 ? "+" : ""}${d.years.toFixed(1)}y`}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function HelpHurt({ result }: { result: NonNullable<Awaited<ReturnType<typeof getBiologicalAge>>> }) {
  const helping = result.modifiers.filter((m) => m.years < 0).slice(0, 3);
  const hurting = result.modifiers.filter((m) => m.years > 0).slice(0, 3);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="size-4 text-emerald-500" /> Helping
          </CardTitle>
        </CardHeader>
        <CardContent>
          {helping.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing pulling you younger yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {helping.map((m, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{m.label}</span>
                  <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{m.years.toFixed(1)}y</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4 text-rose-500" /> Hurting
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hurting.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing pushing you older. Nice.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {hurting.map((m, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{m.label}</span>
                  <span className="tabular-nums text-rose-600 dark:text-rose-400">+{m.years.toFixed(1)}y</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConfidenceFooter({ result }: { result: NonNullable<Awaited<ReturnType<typeof getBiologicalAge>>> }) {
  const pct = Math.round(result.confidence * 100);
  return (
    <Card>
      <CardContent className="py-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Confidence</span>
          <span className="font-medium">{pct}%</span>
        </div>
        <Progress value={pct} className="h-1.5" />
        <p className="text-xs text-muted-foreground">
          Based on {result.daysLogged} days logged in the last 30.{" "}
          {result.missingInputs.length > 0 && `Add ${result.missingInputs.join(", ").toLowerCase()} in Settings to improve accuracy.`}
        </p>
      </CardContent>
    </Card>
  );
}
