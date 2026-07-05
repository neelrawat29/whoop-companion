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

  const { data: suppCount } = useQuery({
    queryKey: ["supplements-count"],
    queryFn: async () => {
      const { count } = await supabase.from("user_supplements").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });



  const firstName = (profile?.display_name ?? "").trim().split(/\s+/)[0] || "";
  const rec = recommend(entry?.recovery, profile?.threshold_push, profile?.threshold_rest);
  const totalKcal = (meals ?? []).reduce((s, m) => s + (m.kcal ?? 0), 0);
  const totalP = (meals ?? []).reduce((s, m) => s + Number(m.protein_g ?? 0), 0);
  const totalC = (meals ?? []).reduce((s, m) => s + Number(m.carbs_g ?? 0), 0);
  const totalF = (meals ?? []).reduce((s, m) => s + Number(m.fat_g ?? 0), 0);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="border-b border-border/50 pb-5">
        {firstName && <p className="text-sm text-muted-foreground mb-1">Welcome, {firstName}</p>}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{fmtDate(date)}</h1>
        <p className="text-muted-foreground text-sm mt-1">Your daily snapshot.</p>
      </div>

      <Card className="bg-gradient-to-br from-card to-accent/30 shadow-sm">
        <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="min-w-0">
            <CardDescription className="text-[11px] uppercase tracking-wider">Today's recommendation</CardDescription>
            <CardTitle className={`text-2xl sm:text-4xl leading-tight mt-1 ${recoveryColor(entry?.recovery, profile?.threshold_push, profile?.threshold_rest)}`}>
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
            <div className="grid grid-cols-2 md:grid-cols-4 md:divide-x md:divide-border/60 gap-y-4">
              <Metric label="Recovery" value={`${entry.recovery}%`} icon={Heart} />
              <Metric label="HRV" value={entry.hrv ? `${entry.hrv} ms` : "—"} icon={Activity} />
              <Metric label="RHR" value={entry.rhr ? `${entry.rhr} bpm` : "—"} icon={Heart} />
              <Metric label="Sleep" value={entry.sleep_hours ? `${entry.sleep_hours} h` : "—"} icon={Moon} />
            </div>
            {yesterday?.recovery != null && (
              <p className="text-sm text-muted-foreground mt-5">
                vs yesterday: {entry.recovery - yesterday.recovery > 0 ? "+" : ""}
                {entry.recovery - yesterday.recovery} pts
              </p>
            )}
          </CardContent>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <SectionHeader icon={Moon} title="Habits" description="Evening check-in" action={<EditLink to="/log" hash="evening" label="Edit" />} />
          <CardContent>
            {!habits && <Empty text="Nothing logged yet." />}
            {habits && (
              <div className="space-y-4 text-sm">
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
                {habits.note && <p className="text-muted-foreground italic pt-3 mt-1 border-t border-border/60">"{habits.note}"</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <SectionHeader
            icon={Pill}
            title="Supplements"
            description={
              (suppCount ?? 0) === 0
                ? "No supplements saved yet"
                : `${(habits?.supplements ?? []).length} of ${suppCount} taken today`
            }
            action={<EditLink to="/supplements" label="Log" />}
          />
          <CardContent>
            {(habits?.supplements ?? []).length === 0 && (
              <Empty text={(suppCount ?? 0) === 0 ? "Add your first supplement to start logging." : "Log what you took today."} />
            )}
            <div className="flex flex-wrap gap-2">
              {(habits?.supplements ?? []).map((s: string) => (
                <span key={s} className="px-3 py-1 rounded-full text-sm bg-accent">{s}</span>
              ))}
            </div>
          </CardContent>
        </Card>


        <Card className="md:col-span-2">
          <SectionHeader
            icon={UtensilsCrossed}
            title="Meals"
            description={`${totalKcal} kcal · ${Math.round(totalP)}P / ${Math.round(totalC)}C / ${Math.round(totalF)}F`}
            action={<EditLink to="/meals" label="Log" />}
          />
          <CardContent>
            {(meals ?? []).length === 0 && <Empty text="No meals logged." />}
            <div className="divide-y divide-border/60">
              {SLOTS.map((slot) => {
                const slotMeals = (meals ?? []).filter((m) => m.slot === slot);
                if (slotMeals.length === 0) return null;
                const kcal = slotMeals.reduce((s, m) => s + (m.kcal ?? 0), 0);
                return (
                  <div key={slot} className="flex items-start justify-between gap-3 text-sm py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="font-medium">{SLOT_LABEL[slot]}</div>
                      <div className="text-muted-foreground truncate">
                        {slotMeals.map((m) => m.description || "—").join(" · ")}
                      </div>
                    </div>
                    <div className="text-sm font-semibold whitespace-nowrap tabular-nums">{kcal} kcal</div>
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

function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <CardHeader className="flex flex-row items-start justify-between gap-2">
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-8 rounded-md bg-accent grid place-items-center shrink-0">
          <Icon className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </div>
      {action}
    </CardHeader>
  );
}

function EditLink({ to, hash, label }: { to: string; hash?: string; label: string }) {
  return (
    <Link
      to={to}
      hash={hash}
      className="text-xs text-muted-foreground hover:text-primary hover:bg-accent flex items-center gap-1 shrink-0 px-2 py-1 rounded-md transition-colors"
    >
      <Pencil className="size-3" /> {label}
    </Link>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="md:px-4 first:md:pl-0 last:md:pr-0">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="text-3xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{value ?? "—"}</div>
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-4">{children}</div>;
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
