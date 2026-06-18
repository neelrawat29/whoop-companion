import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Scale, Plus, Trash2, Target, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { today, fmtDate } from "@/lib/recovery";
import {
  computeProgress,
  filterRange,
  fmtWeight,
  fromDisplay,
  toDisplay,
  unitLabel,
  type WeightEntry,
  type WeightUnit,
} from "@/lib/weight";
import { WeightChart } from "@/components/weight/WeightChart";
import { BodySilhouetteRing } from "@/components/weight/BodySilhouetteRing";

export const Route = createFileRoute("/_authenticated/weight")({
  component: WeightPage,
});

type Profile = {
  weight_goal_kg: number | null;
  weight_goal_date: string | null;
  weight_unit: WeightUnit;
};

type Range = "1M" | "3M" | "6M" | "1Y" | "ALL";

function WeightPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState<Range>("3M");
  const [logOpen, setLogOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile-weight"],
    queryFn: async (): Promise<Profile> => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("profiles")
        .select("weight_goal_kg, weight_goal_date, weight_unit")
        .eq("id", u.user!.id)
        .single();
      return {
        weight_goal_kg: (data as any)?.weight_goal_kg ?? null,
        weight_goal_date: (data as any)?.weight_goal_date ?? null,
        weight_unit: ((data as any)?.weight_unit ?? "kg") as WeightUnit,
      };
    },
  });

  const unit: WeightUnit = profile?.weight_unit ?? "kg";

  const { data: entries } = useQuery({
    queryKey: ["weight_entries"],
    queryFn: async (): Promise<WeightEntry[]> => {
      const { data } = await supabase
        .from("weight_entries" as any)
        .select("entry_date, weight_kg")
        .order("entry_date", { ascending: true });
      return ((data ?? []) as any[]).map((r) => ({
        entry_date: r.entry_date as string,
        weight_kg: Number(r.weight_kg),
      }));
    },
  });

  const allEntries = entries ?? [];
  const filtered = useMemo(() => filterRange(allEntries, range), [allEntries, range]);
  const progress = useMemo(
    () => computeProgress(allEntries, profile?.weight_goal_kg ?? null, profile?.weight_goal_date ?? null),
    [allEntries, profile?.weight_goal_kg, profile?.weight_goal_date],
  );

  const latest = allEntries[allEntries.length - 1];

  const setUnit = useMutation({
    mutationFn: async (next: WeightUnit) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("profiles").update({ weight_unit: next }).eq("id", u.user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile-weight"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (entry_date: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("weight_entries" as any)
        .delete()
        .eq("user_id", u.user!.id)
        .eq("entry_date", entry_date);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight_entries"] });
      toast.success("Entry removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="size-7 text-primary" /> Weight
          </h1>
          <p className="text-muted-foreground text-sm">
            {latest ? `Latest: ${fmtWeight(latest.weight_kg, unit)} · ${fmtDate(latest.entry_date)}` : "Track your weight journey."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(["kg", "lbs"] as const).map((u) => (
              <button
                key={u}
                onClick={() => unit !== u && setUnit.mutate(u)}
                className={`px-2.5 py-1 text-xs rounded ${
                  unit === u ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
          <LogWeightDialog open={logOpen} onOpenChange={setLogOpen} unit={unit} prefillKg={latest?.weight_kg ?? null} />
        </div>
      </div>

      {allEntries.length === 0 ? (
        <EmptyState onLog={() => setLogOpen(true)} />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="flex items-center justify-center py-8">
              <BodySilhouetteRing
                currentKg={progress.currentKg}
                startKg={progress.startKg}
                goalKg={progress.goalKg}
                progressPct={progress.progressPct}
                unit={unit}
              />
            </Card>

            <GoalCard
              progress={progress}
              unit={unit}
              goalDate={profile?.weight_goal_date ?? null}
              onEdit={() => setGoalOpen(true)}
            />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardDescription>Trend</CardDescription>
                <CardTitle className="text-lg">Weight over time</CardTitle>
              </div>
              <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
                {(["1M", "3M", "6M", "1Y", "ALL"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-2 py-1 rounded ${
                      range === r ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <WeightChart entries={filtered} goalKg={progress.goalKg} unit={unit} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent entries</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {[...allEntries]
                .reverse()
                .slice(0, 12)
                .map((e) => (
                  <div key={e.entry_date} className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-sm font-medium">{fmtWeight(e.weight_kg, unit)}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(e.entry_date)}</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => del.mutate(e.entry_date)} className="text-muted-foreground">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
            </CardContent>
          </Card>
        </>
      )}

      <GoalDialog
        open={goalOpen}
        onOpenChange={setGoalOpen}
        unit={unit}
        currentGoalKg={profile?.weight_goal_kg ?? null}
        currentGoalDate={profile?.weight_goal_date ?? null}
      />
    </div>
  );
}

function EmptyState({ onLog }: { onLog: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 flex flex-col items-center text-center gap-4">
        <div className="size-14 rounded-full bg-accent flex items-center justify-center">
          <Scale className="size-7 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Start your weight journey</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Log your weight whenever you weigh in. See your trend, projected ETA, and progress toward your goal.
          </p>
        </div>
        <Button onClick={onLog}>
          <Plus className="size-4 mr-1.5" /> Log your first weight
        </Button>
      </CardContent>
    </Card>
  );
}

function GoalCard({
  progress,
  unit,
  goalDate,
  onEdit,
}: {
  progress: ReturnType<typeof computeProgress>;
  unit: WeightUnit;
  goalDate: string | null;
  onEdit: () => void;
}) {
  const { status, goalKg, toGoalKg, trendKgPerDay, etaDate, progressPct } = progress;

  const StatusIcon = status === "on-track" ? TrendingDown : status === "off-track" ? TrendingUp : Minus;
  const statusColor =
    status === "on-track" || status === "achieved"
      ? "text-[color:var(--recovery-high)]"
      : status === "off-track"
        ? "text-[color:var(--recovery-low)]"
        : "text-muted-foreground";
  const statusLabel = {
    "on-track": "On track",
    "off-track": "Off track",
    stalled: "Trend stalled",
    achieved: "Goal reached 🎉",
    "no-goal": "No goal set",
    "no-data": "Add an entry",
  }[status];

  const weeklyTrend = trendKgPerDay != null ? trendKgPerDay * 7 : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardDescription className="flex items-center gap-1.5">
            <Target className="size-3.5" /> Goal
          </CardDescription>
          <CardTitle className="text-lg">{goalKg != null ? fmtWeight(goalKg, unit) : "Set a target"}</CardTitle>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          {goalKg != null ? "Edit" : "Set goal"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {goalKg != null && (
          <>
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium tabular-nums">{progressPct.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-[color:var(--recovery-high)] transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat
                label={toGoalKg > 0 ? "To lose" : "To gain"}
                value={fmtWeight(Math.abs(toGoalKg), unit)}
              />
              <Stat
                label="Weekly trend"
                value={
                  weeklyTrend == null
                    ? "—"
                    : `${weeklyTrend > 0 ? "+" : ""}${(unit === "kg" ? weeklyTrend : weeklyTrend / 0.45359237).toFixed(2)} ${unitLabel(unit)}/wk`
                }
              />
              <Stat
                label="Projected"
                value={etaDate ? new Date(etaDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
              />
              <Stat
                label="Target"
                value={goalDate ? new Date(goalDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
              />
            </div>
          </>
        )}

        <div className={`flex items-center gap-2 text-sm font-medium ${statusColor}`}>
          <StatusIcon className="size-4" /> {statusLabel}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function LogWeightDialog({
  open,
  onOpenChange,
  unit,
  prefillKg,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  unit: WeightUnit;
  prefillKg: number | null;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [date, setDate] = useState(today());

  function onOpen(b: boolean) {
    if (b) {
      const prefill = toDisplay(prefillKg, unit);
      setValue(prefill != null ? prefill.toFixed(1) : "");
      setDate(today());
    }
    onOpenChange(b);
  }

  const save = useMutation({
    mutationFn: async () => {
      const v = parseFloat(value);
      if (!v || v <= 0) throw new Error("Enter a valid weight");
      const weight_kg = Number(fromDisplay(v, unit).toFixed(2));
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("weight_entries" as any)
        .upsert(
          { user_id: u.user!.id, entry_date: date, weight_kg },
          { onConflict: "user_id,entry_date" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Weight logged");
      qc.invalidateQueries({ queryKey: ["weight_entries"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4 mr-1.5" /> Log weight
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log weight</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="weight">Weight ({unitLabel(unit)})</Label>
            <Input
              id="weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={unit === "kg" ? "e.g. 72.5" : "e.g. 160.0"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GoalDialog({
  open,
  onOpenChange,
  unit,
  currentGoalKg,
  currentGoalDate,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  unit: WeightUnit;
  currentGoalKg: number | null;
  currentGoalDate: string | null;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [date, setDate] = useState("");

  function onOpen(b: boolean) {
    if (b) {
      const v = toDisplay(currentGoalKg, unit);
      setValue(v != null ? v.toFixed(1) : "");
      setDate(currentGoalDate ?? "");
    }
    onOpenChange(b);
  }

  const save = useMutation({
    mutationFn: async () => {
      const v = parseFloat(value);
      if (!v || v <= 0) throw new Error("Enter a valid target weight");
      const weight_goal_kg = Number(fromDisplay(v, unit).toFixed(2));
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("profiles")
        .update({ weight_goal_kg, weight_goal_date: date || null })
        .eq("id", u.user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Goal saved");
      qc.invalidateQueries({ queryKey: ["profile-weight"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clear = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("profiles")
        .update({ weight_goal_kg: null, weight_goal_date: null })
        .eq("id", u.user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-weight"] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Weight goal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="goal-weight">Target weight ({unitLabel(unit)})</Label>
            <Input
              id="goal-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={unit === "kg" ? "e.g. 68.0" : "e.g. 150.0"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-date">Target date (optional)</Label>
            <Input id="goal-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {currentGoalKg != null && (
            <Button variant="ghost" onClick={() => clear.mutate()} className="text-muted-foreground mr-auto">
              Clear goal
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
