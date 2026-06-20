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
import { Heart, Moon, Wine, Coffee, Droplets, Briefcase, Home as HomeIcon, Sun, Activity } from "lucide-react";
import { SegmentedScale } from "@/components/ui/segmented-scale";
import { cn } from "@/lib/utils";
import { SaveBar, flashRingClasses } from "@/components/save-bar";

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
          <div className="flex items-center gap-2">
            {date !== today() && (
              <button
                type="button"
                onClick={() => setDate(today())}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                Today
              </button>
            )}
            <DatePicker value={date} onChange={(d) => setDate(d || today())} disableFuture />
          </div>
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
                  HRV {e.hrv ?? "—"} · Sleep {e.sleep_hours ?? "—"}h
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
  const [sleepScore, setSleepScore] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [snapshot, setSnapshot] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const r = entry?.recovery?.toString() ?? "";
    const h = entry?.hrv?.toString() ?? "";
    const ss = entry?.sleep_score?.toString() ?? "";
    const sh = entry?.sleep_hours?.toString() ?? "";
    setRecovery(r); setHrv(h); setSleepScore(ss); setSleepHours(sh);
    setSnapshot(JSON.stringify([r, h, ss, sh]));
    setLastSavedAt(entry?.updated_at ? new Date(entry.updated_at) : entry ? new Date() : null);
  }, [entry, date]);

  const current = JSON.stringify([recovery, hrv, sleepScore, sleepHours]);
  const isDirty = current !== snapshot;
  const isSaved = !!entry || lastSavedAt !== null;

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("daily_entries").upsert({
        user_id: u.user!.id,
        entry_date: date,
        recovery: recovery ? parseInt(recovery) : null,
        hrv: hrv ? parseFloat(hrv) : null,
        sleep_score: sleepScore ? parseInt(sleepScore) : null,
        sleep_hours: sleepHours ? parseFloat(sleepHours) : null,
        source: "manual",
      }, { onConflict: "user_id,entry_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Morning saved");
      setSnapshot(current);
      setLastSavedAt(new Date());
      setFlash(true);
      setTimeout(() => setFlash(false), 800);
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className={cn("transition-shadow", flash && "ring-2 ring-green-500/60 shadow-[0_0_0_4px_rgba(34,197,94,0.15)]")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Heart className="size-5 text-primary" /> Morning check-in</CardTitle>
        <CardDescription>From your Whoop app. Or use <Link to="/import" className="underline">Import</Link>.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Recovery %" value={recovery} onChange={setRecovery} type="number" min={0} max={100} />
          <Field label="HRV (ms)" value={hrv} onChange={setHrv} type="number" step="0.1" />
          <Field label="Sleep score" value={sleepScore} onChange={setSleepScore} type="number" min={0} max={100} />
          <Field label="Sleep (h)" value={sleepHours} onChange={setSleepHours} type="number" step="0.1" />
          <div className="col-span-2 md:col-span-4">
            <SaveBar
              isDirty={isDirty}
              isPending={save.isPending}
              isSaved={isSaved}
              lastSavedAt={lastSavedAt}
              dirtyLabel="Save morning"
            />
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
  const [meal, setMeal] = useState("");
  const [hydration, setHydration] = useState("0");
  const [mood, setMood] = useState("");
  const [energy, setEnergy] = useState("");
  const [strain, setStrain] = useState("");
  const [note, setNote] = useState("");
  const [workLocation, setWorkLocation] = useState<string>("");
  const [snapshot, setSnapshot] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const d = habits?.drinks?.toString() ?? "0";
    const c = habits?.last_caffeine_time?.slice(0, 5) ?? "";
    const b = habits?.bedtime?.slice(0, 5) ?? "";
    const m = habits?.last_meal_time?.slice(0, 5) ?? "";
    const hy = habits?.hydration?.toString() ?? "0";
    const mo = habits?.mood?.toString() ?? "";
    const en = habits?.energy?.toString() ?? "";
    const st = (habits as any)?.strain?.toString() ?? "";
    const n = habits?.note ?? "";
    const wl = (habits as any)?.work_location ?? "";
    setDrinks(d); setCaffeine(c); setBedtime(b); setMeal(m); setHydration(hy);
    setMood(mo); setEnergy(en); setStrain(st); setNote(n); setWorkLocation(wl);
    setSnapshot(JSON.stringify([d, c, b, m, hy, mo, en, st, n, wl]));
    setLastSavedAt(habits?.updated_at ? new Date(habits.updated_at) : habits ? new Date() : null);
  }, [habits, date]);

  const current = JSON.stringify([drinks, caffeine, bedtime, meal, hydration, mood, energy, strain, note, workLocation]);
  const isDirty = current !== snapshot;
  const isSaved = !!habits || lastSavedAt !== null;


  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("habits_log").upsert({
        user_id: u.user!.id,
        entry_date: date,
        drinks: parseInt(drinks) || 0,
        last_caffeine_time: caffeine || null,
        bedtime: bedtime || null,
        last_meal_time: meal || null,
        hydration: parseInt(hydration) || 0,
        mood: mood ? parseInt(mood) : null,
        energy: energy ? parseInt(energy) : null,
        strain: strain ? parseFloat(strain) : null,
        note: note || null,
        work_location: workLocation || null,
      } as any, { onConflict: "user_id,entry_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evening saved");
      setSnapshot(current);
      setLastSavedAt(new Date());
      setFlash(true);
      setTimeout(() => setFlash(false), 800);
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className={cn("transition-shadow", flash && "ring-2 ring-green-500/60 shadow-[0_0_0_4px_rgba(34,197,94,0.15)]")}>

      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Moon className="size-5 text-primary" /> Evening check-in</CardTitle>
        <CardDescription>Habits that drive recovery.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Strain (0–21)" value={strain} onChange={setStrain} type="number" min={0} max={21} step="0.1" icon={Activity} />
            <Field label="Drinks" value={drinks} onChange={setDrinks} type="number" min={0} icon={Wine} />
            <Field label="Hydration (ml)" value={hydration} onChange={setHydration} type="number" min={0} icon={Droplets} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
            <TimeField label="Bedtime" icon={Moon} value={bedtime} onChange={setBedtime} defaultPeriod="PM" defaultHour={10} />
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


          <div className="space-y-3">
            <div>
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Energy</Label>
              <SegmentedScale
                className="mt-1.5"
                value={energy ? parseInt(energy) : null}
                onChange={(v) => setEnergy(v == null ? "" : String(v))}
                options={[
                  { value: 1, label: "Drained" },
                  { value: 2, label: "Low" },
                  { value: 3, label: "OK" },
                  { value: 4, label: "Good" },
                  { value: 5, label: "Great" },
                ]}
              />
            </div>
            <div>
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mood</Label>
              <SegmentedScale
                className="mt-1.5"
                value={mood ? parseInt(mood) : null}
                onChange={(v) => setMood(v == null ? "" : String(v))}
                options={[
                  { value: 1, label: "Awful" },
                  { value: 2, label: "Low" },
                  { value: 3, label: "OK" },
                  { value: 4, label: "Good" },
                  { value: 5, label: "Amazing" },
                ]}
              />
            </div>
          </div>

          <div>
            <Label className="text-sm">Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="One line about today..." className="mt-1.5" />
          </div>

          <SaveBar
            isDirty={isDirty}
            isPending={save.isPending}
            isSaved={isSaved}
            lastSavedAt={lastSavedAt}
            dirtyLabel="Save evening"
          />

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
