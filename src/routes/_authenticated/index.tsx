import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { today, fmtDate, recommend, recoveryColor } from "@/lib/recovery";
import { toast } from "sonner";
import { Dumbbell, Heart, Moon, Activity, Wine, Coffee, Droplets, Briefcase, Home as HomeIcon, Sun } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: TodayPage,
});

function TodayPage() {
  const date = today();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").maybeSingle();
      return data;
    },
  });

  const { data: entry } = useQuery({
    queryKey: ["entry", date],
    queryFn: async () => {
      const { data } = await supabase.from("daily_entries").select("*").eq("entry_date", date).maybeSingle();
      return data;
    },
  });

  const { data: yesterday } = useQuery({
    queryKey: ["entry-yesterday"],
    queryFn: async () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const iso = d.toISOString().slice(0, 10);
      const { data } = await supabase.from("daily_entries").select("*").eq("entry_date", iso).maybeSingle();
      return data;
    },
  });

  const { data: habits } = useQuery({
    queryKey: ["habits", date],
    queryFn: async () => {
      const { data } = await supabase.from("habits_log").select("*").eq("entry_date", date).maybeSingle();
      return data;
    },
  });

  const rec = recommend(entry?.recovery, profile?.threshold_push, profile?.threshold_rest);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{fmtDate(date)}</h1>
        <p className="text-muted-foreground text-sm">Log your morning and evening check-ins.</p>
      </div>

      <Card className={rec ? `border-2` : ""}>
        <CardHeader>
          <CardDescription>Today's recommendation</CardDescription>
          <CardTitle className={`text-3xl ${recoveryColor(entry?.recovery, profile?.threshold_push, profile?.threshold_rest)}`}>
            {rec === "push" && "Push hard"}
            {rec === "moderate" && "Moderate effort"}
            {rec === "rest" && "Rest & recover"}
            {!rec && "Log recovery to get today's plan"}
          </CardTitle>
        </CardHeader>
        {entry?.recovery != null && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Metric label="Recovery" value={`${entry.recovery}%`} icon={Heart} />
              <Metric label="HRV" value={entry.hrv ? `${entry.hrv} ms` : "—"} icon={Activity} />
              <Metric label="RHR" value={entry.rhr ? `${entry.rhr} bpm` : "—"} icon={Heart} />
              <Metric label="Sleep" value={entry.sleep_hours ? `${entry.sleep_hours} h` : "—"} icon={Moon} />
            </div>
            {yesterday?.recovery != null && (
              <p className="text-sm text-muted-foreground mt-4">
                vs yesterday: {entry.recovery - yesterday.recovery > 0 ? "+" : ""}
                {entry.recovery - yesterday.recovery} pts
              </p>
            )}
          </CardContent>
        )}
      </Card>

      <MorningCard date={date} entry={entry} onSaved={() => qc.invalidateQueries({ queryKey: ["entry", date] })} />
      <EveningCard date={date} habits={habits} onSaved={() => qc.invalidateQueries({ queryKey: ["habits", date] })} />
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="size-3.5" />{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function MorningCard({ date, entry, onSaved }: { date: string; entry: any; onSaved: () => void }) {
  const [recovery, setRecovery] = useState("");
  const [hrv, setHrv] = useState("");
  const [rhr, setRhr] = useState("");
  const [sleepScore, setSleepScore] = useState("");
  const [sleepHours, setSleepHours] = useState("");

  useEffect(() => {
    if (entry) {
      setRecovery(entry.recovery?.toString() ?? "");
      setHrv(entry.hrv?.toString() ?? "");
      setRhr(entry.rhr?.toString() ?? "");
      setSleepScore(entry.sleep_score?.toString() ?? "");
      setSleepHours(entry.sleep_hours?.toString() ?? "");
    }
  }, [entry]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("daily_entries").upsert({
        user_id: u.user!.id,
        entry_date: date,
        recovery: recovery ? parseInt(recovery) : null,
        hrv: hrv ? parseFloat(hrv) : null,
        rhr: rhr ? parseFloat(rhr) : null,
        sleep_score: sleepScore ? parseInt(sleepScore) : null,
        sleep_hours: sleepHours ? parseFloat(sleepHours) : null,
        source: "manual",
      }, { onConflict: "user_id,entry_date" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Morning logged"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Heart className="size-5 text-primary" /> Morning check-in</CardTitle>
        <CardDescription>From your Whoop app. Or use <Link to="/import" className="underline">Import</Link>.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Field label="Recovery %" value={recovery} onChange={setRecovery} type="number" min={0} max={100} />
          <Field label="HRV (ms)" value={hrv} onChange={setHrv} type="number" step="0.1" />
          <Field label="RHR (bpm)" value={rhr} onChange={setRhr} type="number" step="0.1" />
          <Field label="Sleep score" value={sleepScore} onChange={setSleepScore} type="number" min={0} max={100} />
          <Field label="Sleep (h)" value={sleepHours} onChange={setSleepHours} type="number" step="0.1" />
          <div className="col-span-2 md:col-span-5">
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving..." : "Save morning"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function EveningCard({ date, habits, onSaved }: { date: string; habits: any; onSaved: () => void }) {
  const [drinks, setDrinks] = useState("0");
  const [caffeine, setCaffeine] = useState("");
  const [bedtime, setBedtime] = useState("");
  const [wake, setWake] = useState("");
  const [screen, setScreen] = useState("");
  const [meal, setMeal] = useState("");
  const [hydration, setHydration] = useState("0");
  const [cool, setCool] = useState(false);
  const [mood, setMood] = useState("");
  const [energy, setEnergy] = useState("");
  const [note, setNote] = useState("");
  const [supplements, setSupplements] = useState<string[]>([]);

  const { data: suppList } = useQuery({
    queryKey: ["supplements"],
    queryFn: async () => {
      const { data } = await supabase.from("user_supplements").select("*").order("name");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (habits) {
      setDrinks(habits.drinks?.toString() ?? "0");
      setCaffeine(habits.last_caffeine_time?.slice(0, 5) ?? "");
      setBedtime(habits.bedtime?.slice(0, 5) ?? "");
      setWake(habits.wake_time?.slice(0, 5) ?? "");
      setScreen(habits.screen_cutoff?.slice(0, 5) ?? "");
      setMeal(habits.last_meal_time?.slice(0, 5) ?? "");
      setHydration(habits.hydration?.toString() ?? "0");
      setCool(!!habits.cool_room);
      setMood(habits.mood?.toString() ?? "");
      setEnergy(habits.energy?.toString() ?? "");
      setNote(habits.note ?? "");
      setSupplements(habits.supplements ?? []);
    }
  }, [habits]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("habits_log").upsert({
        user_id: u.user!.id,
        entry_date: date,
        drinks: parseInt(drinks) || 0,
        last_caffeine_time: caffeine || null,
        bedtime: bedtime || null,
        wake_time: wake || null,
        screen_cutoff: screen || null,
        last_meal_time: meal || null,
        hydration: parseInt(hydration) || 0,
        cool_room: cool,
        mood: mood ? parseInt(mood) : null,
        energy: energy ? parseInt(energy) : null,
        note: note || null,
        supplements,
      }, { onConflict: "user_id,entry_date" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Evening logged"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Moon className="size-5 text-primary" /> Evening check-in</CardTitle>
        <CardDescription>Habits that drive recovery.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Drinks" value={drinks} onChange={setDrinks} type="number" min={0} icon={Wine} />
            <Field label="Last caffeine" value={caffeine} onChange={setCaffeine} type="time" icon={Coffee} />
            <Field label="Hydration (glasses)" value={hydration} onChange={setHydration} type="number" min={0} icon={Droplets} />
            <Field label="Last meal" value={meal} onChange={setMeal} type="time" />
            <Field label="Bedtime" value={bedtime} onChange={setBedtime} type="time" />
            <Field label="Wake time" value={wake} onChange={setWake} type="time" />
            <Field label="Screen cutoff" value={screen} onChange={setScreen} type="time" />
            <div className="flex items-end gap-2 pb-2">
              <Switch checked={cool} onCheckedChange={setCool} id="cool" />
              <Label htmlFor="cool" className="text-sm">Cool room</Label>
            </div>
          </div>

          <div>
            <Label className="text-sm">Supplements taken</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {(suppList ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Add supplements in <Link to="/settings" className="underline">Settings</Link>.</p>
              )}
              {(suppList ?? []).map((s) => {
                const on = supplements.includes(s.name);
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setSupplements((prev) => on ? prev.filter((x) => x !== s.name) : [...prev, s.name])}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Mood 1–5" value={mood} onChange={setMood} type="number" min={1} max={5} />
            <Field label="Energy 1–5" value={energy} onChange={setEnergy} type="number" min={1} max={5} />
          </div>

          <div>
            <Label className="text-sm">Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="One line about today..." className="mt-1.5" />
          </div>

          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving..." : "Save evening"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, icon: Icon, ...rest }: { label: string; value: string; onChange: (v: string) => void; icon?: any } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1">{Icon && <Icon className="size-3" />}{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}
