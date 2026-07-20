import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRecapDefaults, saveRecap } from "@/lib/recap.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/recap")({
  component: RecapPage,
});

type SlotKey = "breakfast" | "lunch" | "dinner";

function RecapPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchDefaults = useServerFn(getRecapDefaults);
  const saveFn = useServerFn(saveRecap);

  const { data, isLoading } = useQuery({ queryKey: ["recap-defaults"], queryFn: () => fetchDefaults() });

  // Selection state
  const [includeMetrics, setIncludeMetrics] = useState(false);
  const [recovery, setRecovery] = useState("");
  const [hrv, setHrv] = useState("");
  const [rhr, setRhr] = useState("");
  const [sleep, setSleep] = useState("");

  const [includeHabits, setIncludeHabits] = useState(false);
  const [energy, setEnergy] = useState("");
  const [mood, setMood] = useState("");
  const [hydration, setHydration] = useState("");
  const [bedtime, setBedtime] = useState("");

  const [includeWeight, setIncludeWeight] = useState(false);
  const [weight, setWeight] = useState("");

  const [mealChecks, setMealChecks] = useState<Record<SlotKey, boolean>>({ breakfast: false, lunch: false, dinner: false });

  useEffect(() => {
    if (!data) return;
    if (data.missing.metrics) setIncludeMetrics(true);
    if (data.missing.energy || data.missing.mood || data.missing.water || data.missing.bedtime) setIncludeHabits(true);
    if (data.missing.weight && data.defaults.weight_kg != null) setIncludeWeight(true);
    setEnergy(data.defaults.energy != null ? String(data.defaults.energy) : "");
    setMood(data.defaults.mood != null ? String(data.defaults.mood) : "");
    setHydration(data.defaults.hydration != null ? String(data.defaults.hydration) : "");
    setBedtime(data.defaults.bedtime ?? "");
    setWeight(data.defaults.weight_kg != null ? String(data.defaults.weight_kg) : "");
    setMealChecks({
      breakfast: data.missing.breakfast && !!data.defaults.last_meal_by_slot.breakfast,
      lunch: data.missing.lunch && !!data.defaults.last_meal_by_slot.lunch,
      dinner: data.missing.dinner && !!data.defaults.last_meal_by_slot.dinner,
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      if (includeMetrics) {
        payload.metrics = {
          recovery: recovery ? Number(recovery) : null,
          hrv: hrv ? Number(hrv) : null,
          rhr: rhr ? Number(rhr) : null,
          sleep_hours: sleep ? Number(sleep) : null,
        };
      }
      if (includeHabits) {
        payload.habits = {
          energy: energy ? Number(energy) : null,
          mood: mood ? Number(mood) : null,
          hydration: hydration ? Number(hydration) : null,
          bedtime: bedtime || null,
        };
      }
      if (includeWeight && weight) payload.weight_kg = Number(weight);
      const meals: any[] = [];
      (Object.keys(mealChecks) as SlotKey[]).forEach((slot) => {
        const last = data?.defaults.last_meal_by_slot[slot];
        if (mealChecks[slot] && last) meals.push({ slot, ...last });
      });
      if (meals.length) payload.meals = meals;
      return saveFn({ data: payload });
    },
    onSuccess: (res) => {
      toast.success(
        `Saved. ${[res.wrote.metrics && "metrics", res.wrote.habits && "habits", res.wrote.weight && "weight", res.wrote.meals && `${res.wrote.meals} meals`].filter(Boolean).join(", ") || "nothing to write"}.`,
      );
      qc.invalidateQueries();
      navigate({ to: "/" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  if (isLoading || !data) {
    return <div className="p-6 text-muted-foreground">Loading your recap…</div>;
  }

  const nothingMissing =
    !data.missing.metrics && !data.missing.breakfast && !data.missing.lunch && !data.missing.dinner &&
    !data.missing.water && !data.missing.weight && !data.missing.energy && !data.missing.mood && !data.missing.bedtime;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="text-xs uppercase tracking-wider">End-of-day recap</span></div>
        <h1 className="text-2xl font-bold mt-1">Fill the gaps in one screen</h1>
        <p className="text-muted-foreground text-sm mt-1">Defaults come from your last 7 days. Uncheck anything you don't want to save.</p>
      </div>

      {nothingMissing && (
        <Card><CardContent className="p-6 text-sm">You've already logged everything for today. Nothing to recap 🎉</CardContent></Card>
      )}

      {data.missing.metrics && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div><CardTitle className="text-base">Whoop metrics</CardTitle><CardDescription>Recovery, HRV, RHR, sleep</CardDescription></div>
            <Checkbox checked={includeMetrics} onCheckedChange={(v) => setIncludeMetrics(!!v)} />
          </CardHeader>
          {includeMetrics && (
            <CardContent className="grid grid-cols-2 gap-3">
              <Field label="Recovery %" value={recovery} onChange={setRecovery} />
              <Field label="HRV (ms)" value={hrv} onChange={setHrv} />
              <Field label="RHR (bpm)" value={rhr} onChange={setRhr} />
              <Field label="Sleep (h)" value={sleep} onChange={setSleep} />
            </CardContent>
          )}
        </Card>
      )}

      {(data.missing.energy || data.missing.mood || data.missing.water || data.missing.bedtime) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div><CardTitle className="text-base">Habits</CardTitle><CardDescription>Prefilled from your 7-day median</CardDescription></div>
            <Checkbox checked={includeHabits} onCheckedChange={(v) => setIncludeHabits(!!v)} />
          </CardHeader>
          {includeHabits && (
            <CardContent className="grid grid-cols-2 gap-3">
              {data.missing.energy && <Field label="Energy (1-10)" value={energy} onChange={setEnergy} />}
              {data.missing.mood && <Field label="Mood (1-10)" value={mood} onChange={setMood} />}
              {data.missing.water && <Field label="Hydration (ml)" value={hydration} onChange={setHydration} />}
              {data.missing.bedtime && <Field label="Bedtime (HH:MM)" value={bedtime} onChange={setBedtime} type="time" />}
            </CardContent>
          )}
        </Card>
      )}

      {data.missing.weight && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div><CardTitle className="text-base">Weight</CardTitle><CardDescription>{data.defaults.weight_kg ? `Last: ${data.defaults.weight_kg} kg` : "No prior reading"}</CardDescription></div>
            <Checkbox checked={includeWeight} onCheckedChange={(v) => setIncludeWeight(!!v)} />
          </CardHeader>
          {includeWeight && (
            <CardContent><Field label="Weight (kg)" value={weight} onChange={setWeight} /></CardContent>
          )}
        </Card>
      )}

      {(["breakfast", "lunch", "dinner"] as SlotKey[]).some((s) => data.missing[s] && data.defaults.last_meal_by_slot[s]) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Meals (repeat last week's)</CardTitle><CardDescription>Only shown for slots you haven't logged today.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {(["breakfast", "lunch", "dinner"] as SlotKey[]).map((slot) => {
              const last = data.defaults.last_meal_by_slot[slot];
              if (!data.missing[slot] || !last) return null;
              return (
                <label key={slot} className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer">
                  <Checkbox checked={mealChecks[slot]} onCheckedChange={(v) => setMealChecks((m) => ({ ...m, [slot]: !!v }))} />
                  <div className="text-sm">
                    <div className="font-medium capitalize">{slot}</div>
                    <div className="text-muted-foreground">{last.description} · {last.kcal ?? "?"} kcal · {last.protein_g ?? "?"}g P</div>
                  </div>
                </label>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 pt-2">
        <Button className="flex-1" onClick={() => mutation.mutate()} disabled={mutation.isPending || nothingMissing}>
          {mutation.isPending ? "Saving…" : "Confirm & save"}
        </Button>
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>Skip</Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} inputMode={type === "text" ? "decimal" : undefined} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
