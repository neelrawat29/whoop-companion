import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { getBiologicalAge, getBiologicalAgeHistory } from "@/lib/biological-age.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";

export const Route = createFileRoute("/_authenticated/insights/biological-age")({
  head: () => ({
    meta: [{ title: "Biological Age — Whoop Companion" }],
  }),
  component: BioAgePage,
  errorComponent: BioAgeError,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Not found.</p>,
});

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
  const ageFn = useServerFn(getBiologicalAge);
  const histFn = useServerFn(getBiologicalAgeHistory);
  const { data: result } = useQuery({ queryKey: ["bio-age"], queryFn: () => ageFn() });
  const { data: history } = useQuery({ queryKey: ["bio-age-history"], queryFn: () => histFn() });

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
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Biological Age</h1>
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
            <Link to="/settings">
              <Button>Open Settings</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <HeroNumber result={result} />
          <TrendChart history={history ?? []} chronological={result.chronological} />
          <Breakdown result={result} />
          <HelpHurt result={result} />
          <ConfidenceFooter result={result} />
        </>
      )}
    </div>
  );
}

function HeroNumber({ result }: { result: NonNullable<Awaited<ReturnType<typeof getBiologicalAge>>> }) {
  const delta = result.delta ?? 0;
  const younger = delta < 0;
  const same = Math.abs(delta) < 0.5;
  return (
    <Card>
      <CardContent className="py-8 flex flex-col items-center gap-3">
        <div className="text-7xl font-bold tabular-nums tracking-tight">{result.biological}</div>
        <div className="text-sm text-muted-foreground">
          Chronological age <span className="text-foreground font-medium">{result.chronological}</span>
        </div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
            same
              ? "bg-muted text-muted-foreground"
              : younger
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
          }`}
        >
          {younger ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
          {same
            ? "On par with your age"
            : `${Math.abs(delta).toFixed(1)} years ${younger ? "younger" : "older"}`}
        </div>
      </CardContent>
    </Card>
  );
}

function TrendChart({
  history,
  chronological,
}: {
  history: { date: string; biological: number | null }[];
  chronological: number | null;
}) {
  const data = history.filter((p) => p.biological != null);
  if (data.length < 2) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Trend (90 days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="date" hide />
              <YAxis domain={["dataMin - 2", "dataMax + 2"]} width={32} tickLine={false} axisLine={false} />
              <Tooltip
                labelFormatter={(d) => new Date(d as string).toLocaleDateString()}
                formatter={(v: number) => [v.toFixed(1), "Biological age"]}
              />
              {chronological != null && (
                <ReferenceLine y={chronological} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              )}
              <Line type="monotone" dataKey="biological" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
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
