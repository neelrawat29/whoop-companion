import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { today, fmtDate, recommend, recoveryColor } from "@/lib/recovery";
import { Heart, Moon, Activity, Pill, UtensilsCrossed, Briefcase, Home as HomeIcon, Sun, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: TodayPage,
});

const SLOTS = ["breakfast", "lunch", "dinner", "snacks"] as const;
const SLOT_LABEL: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };

function TodayPage() {
  const date = today();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("*").maybeSingle()).data,
  });

  const { data: entry } = useQuery({
    queryKey: ["entry", date],
    queryFn: async () => (await supabase.from("daily_entries").select("*").eq("entry_date", date).maybeSingle()).data,
  });

  const { data: yesterday } = useQuery({
    queryKey: ["entry-yesterday"],
    queryFn: async () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const iso = d.toISOString().slice(0, 10);
      return (await supabase.from("daily_entries").select("*").eq("entry_date", iso).maybeSingle()).data;
    },
  });

  const { data: habits } = useQuery({
    queryKey: ["habits", date],
    queryFn: async () => (await supabase.from("habits_log").select("*").eq("entry_date", date).maybeSingle()).data,
  });

  const { data: meals } = useQuery({
    queryKey: ["meals", date],
    queryFn: async () => (await supabase.from("meals").select("*").eq("entry_date", date)).data ?? [],
  });

  const rec = recommend(entry?.recovery, profile?.threshold_push, profile?.threshold_rest);
  const totalKcal = (meals ?? []).reduce((s, m) => s + (m.kcal ?? 0), 0);
  const totalP = (meals ?? []).reduce((s, m) => s + Number(m.protein_g ?? 0), 0);
  const totalC = (meals ?? []).reduce((s, m) => s + Number(m.carbs_g ?? 0), 0);
  const totalF = (meals ?? []).reduce((s, m) => s + Number(m.fat_g ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{fmtDate(date)}</h1>
        <p className="text-muted-foreground text-sm">Your daily snapshot.</p>
      </div>

      <Card className={rec ? "border-2" : ""}>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardDescription>Today's recommendation</CardDescription>
            <CardTitle className={`text-3xl ${recoveryColor(entry?.recovery, profile?.threshold_push, profile?.threshold_rest)}`}>
              {rec === "push" && "Push hard"}
              {rec === "moderate" && "Moderate effort"}
              {rec === "rest" && "Rest & recover"}
              {!rec && "Log recovery to get today's plan"}
            </CardTitle>
          </div>
          <EditLink to="/log" hash="morning" label="Edit" />
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

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><Moon className="size-5 text-primary" /> Habits</CardTitle>
              <CardDescription>Evening check-in</CardDescription>
            </div>
            <EditLink to="/log" hash="evening" label="Edit" />
          </CardHeader>
          <CardContent>
            {!habits && <Empty text="Nothing logged yet." />}
            {habits && (
              <div className="space-y-3 text-sm">
                <WorkBadge value={habits.work_location} />
                <Grid2>
                  <Stat label="Drinks" value={habits.drinks ?? 0} />
                  <Stat label="Hydration" value={`${habits.hydration ?? 0} glasses`} />
                  <Stat label="Last caffeine" value={fmtTime(habits.last_caffeine_time)} />
                  <Stat label="Last meal" value={fmtTime(habits.last_meal_time)} />
                  <Stat label="Bedtime" value={fmtTime(habits.bedtime)} />
                  <Stat label="Wake" value={fmtTime(habits.wake_time)} />
                  <Stat label="Screen cutoff" value={fmtTime(habits.screen_cutoff)} />
                  <Stat label="Cool room" value={habits.cool_room ? "Yes" : "No"} />
                  <Stat label="Mood" value={habits.mood ? `${habits.mood}/5` : "—"} />
                  <Stat label="Energy" value={habits.energy ? `${habits.energy}/5` : "—"} />
                </Grid2>
                {habits.note && <p className="text-muted-foreground italic pt-1 border-t border-border">"{habits.note}"</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><Pill className="size-5 text-primary" /> Supplements</CardTitle>
              <CardDescription>{(habits?.supplements ?? []).length} taken today</CardDescription>
            </div>
            <EditLink to="/supplements" label="Log" />
          </CardHeader>
          <CardContent>
            {(habits?.supplements ?? []).length === 0 && <Empty text="None logged yet." />}
            <div className="flex flex-wrap gap-2">
              {(habits?.supplements ?? []).map((s: string) => (
                <span key={s} className="px-3 py-1 rounded-full text-sm bg-accent">{s}</span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><UtensilsCrossed className="size-5 text-primary" /> Meals</CardTitle>
              <CardDescription>
                {totalKcal} kcal · {Math.round(totalP)}P / {Math.round(totalC)}C / {Math.round(totalF)}F
              </CardDescription>
            </div>
            <EditLink to="/meals" label="Log" />
          </CardHeader>
          <CardContent>
            {(meals ?? []).length === 0 && <Empty text="No meals logged." />}
            <div className="space-y-2">
              {SLOTS.map((slot) => {
                const slotMeals = (meals ?? []).filter((m) => m.slot === slot);
                if (slotMeals.length === 0) return null;
                const kcal = slotMeals.reduce((s, m) => s + (m.kcal ?? 0), 0);
                return (
                  <div key={slot} className="flex items-start justify-between gap-3 text-sm border-b border-border pb-2 last:border-0">
                    <div className="min-w-0">
                      <div className="font-medium">{SLOT_LABEL[slot]}</div>
                      <div className="text-muted-foreground truncate">
                        {slotMeals.map((m) => m.description || "—").join(" · ")}
                      </div>
                    </div>
                    <div className="text-sm font-semibold whitespace-nowrap">{kcal} kcal</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EditLink({ to, hash, label }: { to: string; hash?: string; label: string }) {
  return (
    <Link to={to} hash={hash} className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
      <Pencil className="size-3" /> {label}
    </Link>
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

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value ?? "—"}</div>
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-4">{text}</p>;
}

function fmtTime(t: string | null | undefined) {
  if (!t) return "—";
  return t.slice(0, 5);
}

function WorkBadge({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  const map: Record<string, { label: string; icon: any }> = {
    home: { label: "Worked from home", icon: HomeIcon },
    office: { label: "Worked from office", icon: Briefcase },
    off: { label: "Day off", icon: Sun },
  };
  const m = map[value];
  if (!m) return null;
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-accent">
      <Icon className="size-3.5" /> {m.label}
    </span>
  );
}
