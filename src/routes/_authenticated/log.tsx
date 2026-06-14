import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { useState, useEffect } from "react";
import { today, fmtDate, recoveryColor } from "@/lib/recovery";
import { toast } from "sonner";
import { Heart, Moon, Wine, Coffee, Droplets, Briefcase, Home as HomeIcon, Sun } from "lucide-react";

export const Route = createFileRoute("/_authenticated/log")({
  component: LogPage,
});

function LogPage() {
  const [date, setDate] = useState(today());
  const qc = useQueryClient();

  const { data: entry } = useQuery({
    queryKey: ["entry", date],
    queryFn: async () => {
      const { data } = await supabase.from("daily_entries").select("*").eq("entry_date", date).maybeSingle();
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

  const { data: entries } = useQuery({
    queryKey: ["log-entries"],
    queryFn: async () => {
      const { data } = await supabase.from("daily_entries").select("*").order("entry_date", { ascending: false }).limit(90);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Log</h1>
          <p className="text-muted-foreground text-sm">Log today, edit any past day.</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Viewing date</Label>
          <DatePicker value={date} onChange={(d) => setDate(d || today())} disableFuture />
        </div>
      </div>

      <div id="morning">
        <MorningCard date={date} entry={entry} onSaved={() => qc.invalidateQueries({ queryKey: ["entry", date] })} />
      </div>

      <div id="evening">
        <EveningCard date={date} habits={habits} onSaved={() => qc.invalidateQueries({ queryKey: ["habits", date] })} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">History</CardTitle>
          <CardDescription>Last 90 days. Tap a row to edit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {entries && entries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No entries yet.</p>
          )}
          {entries?.map((e) => (
            <button
              key={e.id}
              onClick={() => setDate(e.entry_date)}
              className={`w-full text-left rounded-md border border-border px-3 py-2 flex items-center justify-between transition-colors hover:bg-accent ${e.entry_date === date ? "bg-accent" : ""}`}
            >
              <div>
                <div className="font-medium text-sm">{fmtDate(e.entry_date)}</div>
                <div className="text-xs text-muted-foreground">
                  HRV {e.hrv ?? "—"} · RHR {e.rhr ?? "—"} · Sleep {e.sleep_hours ?? "—"}h
                </div>
              </div>
              <div className={`text-xl font-semibold ${recoveryColor(e.recovery)}`}>
                {e.recovery ?? "—"}{e.recovery != null && "%"}
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
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
    setRecovery(entry?.recovery?.toString() ?? "");
    setHrv(entry?.hrv?.toString() ?? "");
    setRhr(entry?.rhr?.toString() ?? "");
    setSleepScore(entry?.sleep_score?.toString() ?? "");
    setSleepHours(entry?.sleep_hours?.toString() ?? "");
  }, [entry, date]);

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
    onSuccess: () => { toast.success("Morning saved"); onSaved(); },
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
  const [workLocation, setWorkLocation] = useState<string>("");

  const { data: suppList } = useQuery({
    queryKey: ["supplements"],
    queryFn: async () => {
      const { data } = await supabase.from("user_supplements").select("*").order("name");
      return data ?? [];
    },
  });

  useEffect(() => {
    setDrinks(habits?.drinks?.toString() ?? "0");
    setCaffeine(habits?.last_caffeine_time?.slice(0, 5) ?? "");
    setBedtime(habits?.bedtime?.slice(0, 5) ?? "");
    setWake(habits?.wake_time?.slice(0, 5) ?? "");
    setScreen(habits?.screen_cutoff?.slice(0, 5) ?? "");
    setMeal(habits?.last_meal_time?.slice(0, 5) ?? "");
    setHydration(habits?.hydration?.toString() ?? "0");
    setCool(!!habits?.cool_room);
    setMood(habits?.mood?.toString() ?? "");
    setEnergy(habits?.energy?.toString() ?? "");
    setNote(habits?.note ?? "");
    setSupplements(habits?.supplements ?? []);
    setWorkLocation((habits as any)?.work_location ?? "");
  }, [habits, date]);

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
        work_location: workLocation || null,
      } as any, { onConflict: "user_id,entry_date" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Evening saved"); onSaved(); },
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
            <Field label="Hydration (glasses)" value={hydration} onChange={setHydration} type="number" min={0} icon={Droplets} />
            <div className="flex items-end gap-2 pb-2 col-span-2 md:col-span-2">
              <Switch checked={cool} onCheckedChange={setCool} id="cool" />
              <Label htmlFor="cool" className="text-sm">Cool room</Label>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
            <TimeField label="Bedtime" icon={Moon} value={bedtime} onChange={setBedtime} defaultPeriod="PM" defaultHour={10} />
            <TimeField label="Wake time" icon={Sun} value={wake} onChange={setWake} defaultPeriod="AM" defaultHour={7} />
            <TimeField label="Screen cutoff" value={screen} onChange={setScreen} defaultPeriod="PM" defaultHour={9} />
            <TimeField label="Last caffeine" icon={Coffee} value={caffeine} onChange={setCaffeine} defaultPeriod="PM" defaultHour={2} />
            <TimeField label="Last meal" value={meal} onChange={setMeal} defaultPeriod="PM" defaultHour={7} />
          </div>

          <div>
            <Label className="text-sm">Work today</Label>
            <div className="flex gap-2 mt-2">
              {[
                { value: "home", label: "Home", icon: HomeIcon },
                { value: "office", label: "Office", icon: Briefcase },
                { value: "off", label: "Off", icon: Sun },
              ].map(({ value, label, icon: Icon }) => {
                const on = workLocation === value;
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setWorkLocation(on ? "" : value)}
                    className={`px-3 py-1.5 rounded-md text-sm border flex items-center gap-1.5 transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                  >
                    <Icon className="size-4" /> {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Supplements taken ({supplements.length})</Label>
              <Link to="/supplements" className="text-xs text-primary underline">Manage</Link>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {(suppList ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Add supplements in <Link to="/supplements" className="underline">Supplements</Link>.</p>
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

function TimeField({
  label,
  icon: Icon,
  value,
  onChange,
  defaultPeriod,
  defaultHour,
}: {
  label: string;
  icon?: any;
  value: string;
  onChange: (v: string) => void;
  defaultPeriod?: "AM" | "PM";
  defaultHour?: number;
}) {
  return (
    <div className="space-y-2">
      <Label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
        {Icon && <Icon className="size-3" />} {label}
      </Label>
      <TimePicker
        value={value || null}
        onChange={(v) => onChange(v ?? "")}
        defaultPeriod={defaultPeriod}
        defaultHour={defaultHour}
      />
    </div>
  );
}
