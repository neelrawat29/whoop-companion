import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Droplets, Flame, Info } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { covePageHead } from "@/lib/page-head";
import { onboardingProfileSchema } from "@/lib/onboarding.shared";
import { saveOnboarding } from "@/lib/onboarding.functions";
import { computeTargets, computeWaterTarget, type ActivityLevel, type Goal } from "@/lib/targets.shared";
import { WhoopCard } from "@/components/whoop-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: z.object({ step: z.number().int().min(1).max(4).optional() }),
  head: () => covePageHead("Set up Cove", "Personalise your Cove targets in four quick steps."),
  component: OnboardingPage,
});

const GOALS: { v: NonNullable<Goal>; label: string; hint: string }[] = [
  { v: "lose", label: "Lose fat", hint: "500 kcal daily deficit" },
  { v: "maintain", label: "Maintain", hint: "Eat at your burn rate" },
  { v: "gain", label: "Build muscle", hint: "300 kcal daily surplus" },
];
const ACTIVITY: { v: NonNullable<ActivityLevel>; label: string; hint: string }[] = [
  { v: "sedentary", label: "Sedentary", hint: "Desk job, little exercise" },
  { v: "light", label: "Light", hint: "Exercise 1–3 days a week" },
  { v: "moderate", label: "Moderate", hint: "Exercise 3–5 days a week" },
  { v: "active", label: "Active", hint: "Hard exercise 6–7 days a week" },
  { v: "very_active", label: "Very active", hint: "Physical job or twice-daily training" },
];
const SEXES = [
  { v: "male", label: "Male" },
  { v: "female", label: "Female" },
  { v: "other", label: "Other" },
] as const;

function Choice({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
      )}
    >
      <div className="font-medium text-sm">{label}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </button>
  );
}

function OnboardingPage() {
  const { step: urlStep } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const saveFn = useServerFn(saveOnboarding);
  const [step, setStep] = useState(
    () => urlStep ?? (new URLSearchParams(window.location.search).has("whoop") ? 3 : 1),
  );
  const [goal, setGoal] = useState<Goal>(null);
  const [activity, setActivity] = useState<ActivityLevel>(null);
  const [sex, setSex] = useState<"male" | "female" | "other" | null>(null);
  const [birthYear, setBirthYear] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [touched, setTouched] = useState(false);

  // Restore saved answers (e.g. after returning from WHOOP sign-in).
  useEffect(() => {
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("goal,activity_level,sex,birth_year,height_cm,weight_kg")
        .eq("id", u.user.id)
        .maybeSingle();
      if (!p) return;
      if (p.goal) setGoal(p.goal as Goal);
      if (p.activity_level) setActivity(p.activity_level as ActivityLevel);
      if (p.sex) setSex(p.sex);
      if (p.birth_year) setBirthYear(String(p.birth_year));
      if (p.height_cm) setHeight(String(p.height_cm));
      if (p.weight_kg) setWeight(String(p.weight_kg));
    })();
  }, []);

  useEffect(() => {
    void navigate({ to: "/onboarding", search: { step }, replace: true });
  }, [step, navigate]);

  const parsed = onboardingProfileSchema.safeParse({
    goal,
    activity_level: activity,
    sex,
    birth_year: birthYear ? Number(birthYear) : undefined,
    height_cm: height ? Number(height) : undefined,
    weight_kg: weight ? Number(weight) : undefined,
  });
  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) out[String(i.path[0])] ??= i.message;
    return out;
  }, [parsed]);

  const targets = parsed.success ? computeTargets(parsed.data) : null;
  const water = parsed.success ? computeWaterTarget({ weight_kg: parsed.data.weight_kg, sex: parsed.data.sex }) : null;

  const save = useMutation({
    mutationFn: (complete: boolean) => {
      if (!parsed.success) throw new Error("Missing details");
      return saveFn({ data: { ...parsed.data, complete } });
    },
  });

  const next = async () => {
    if (step === 1 && (!goal || !activity)) return setTouched(true);
    if (step === 2) {
      if (!parsed.success) return setTouched(true);
      try {
        await save.mutateAsync(false);
      } catch {
        return toast.error("Couldn't save your details. Please try again.");
      }
    }
    setTouched(false);
    setStep((s) => Math.min(4, s + 1));
  };

  const finish = async () => {
    try {
      await save.mutateAsync(true);
      await qc.invalidateQueries();
      toast.success("You're all set.");
      // Full reload so the setup gate re-reads the completed profile.
      window.location.assign("/");
    } catch {
      toast.error("Couldn't finish setup. Please try again.");
    }
  };

  const fieldErr = (k: string) => (touched && errors[k] ? <p className="text-xs text-destructive mt-1">{errors[k]}</p> : null);

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-xl px-5 py-10">
        <div className="flex items-center justify-between mb-8">
          <span className="font-semibold tracking-tight">Cove</span>
          <span className="text-xs text-muted-foreground">Step {step} of 4</span>
        </div>
        <div className="flex gap-1.5 mb-8" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>

        {step === 1 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold">What are you working towards?</h1>
              <p className="text-sm text-muted-foreground mt-1">Your goal and activity level set your daily calorie target.</p>
            </div>
            <div>
              <Label className="mb-2 block">Goal</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {GOALS.map((g) => (
                  <Choice key={g.v} active={goal === g.v} onClick={() => setGoal(g.v)} label={g.label} hint={g.hint} />
                ))}
              </div>
              {touched && !goal && <p className="text-xs text-destructive mt-1">Choose a goal</p>}
            </div>
            <div>
              <Label className="mb-2 block">Activity level</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {ACTIVITY.map((a) => (
                  <Choice key={a.v} active={activity === a.v} onClick={() => setActivity(a.v)} label={a.label} hint={a.hint} />
                ))}
              </div>
              {touched && !activity && <p className="text-xs text-destructive mt-1">Choose an activity level</p>}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold">About you</h1>
              <p className="text-sm text-muted-foreground mt-1">All four details are required.</p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm space-y-2">
              <div className="flex items-center gap-2 font-medium"><Info className="size-4 text-primary" /> Why these are required</div>
              <p className="text-muted-foreground">Cove uses them so your targets and insights are accurate, not generic:</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><b className="text-foreground">Sex & height</b> — feed the Mifflin–St Jeor formula for the calories your body burns at rest.</li>
                <li><b className="text-foreground">Weight</b> — sets your water target (35 ml/kg for men, 31 ml/kg for women) and protein (1.8 g/kg) to protect muscle.</li>
                <li><b className="text-foreground">Age</b> — your resting burn and heart-health baselines change with age.</li>
              </ul>
            </div>
            <div>
              <Label className="mb-2 block">Sex</Label>
              <div className="grid grid-cols-3 gap-2">
                {SEXES.map((s) => (
                  <Choice key={s.v} active={sex === s.v} onClick={() => setSex(s.v)} label={s.label} />
                ))}
              </div>
              {touched && !sex && <p className="text-xs text-destructive mt-1">Choose one</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="by">Birth year</Label>
                <Input id="by" inputMode="numeric" placeholder="1990" value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                {fieldErr("birth_year")}
              </div>
              <div>
                <Label htmlFor="h">Height (cm)</Label>
                <Input id="h" inputMode="decimal" placeholder="175" value={height} onChange={(e) => setHeight(e.target.value)} />
                {fieldErr("height_cm")}
              </div>
              <div>
                <Label htmlFor="w">Weight (kg)</Label>
                <Input id="w" inputMode="decimal" placeholder="72" value={weight} onChange={(e) => setWeight(e.target.value)} />
                {fieldErr("weight_kg")}
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold">Connect your WHOOP</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Sleep, bedtime, recovery, HRV and strain then fill in automatically — no daily typing.
              </p>
            </div>
            <WhoopCard returnPage="/onboarding" />
            <p className="text-xs text-muted-foreground">No WHOOP? Skip this — you can connect anytime in Settings.</p>
          </section>
        )}

        {step === 4 && targets && water && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold">Your daily targets</h1>
              <p className="text-sm text-muted-foreground mt-1">Built from your goal, activity and body. You can tweak them later in Settings.</p>
            </div>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Flame className="size-4 text-primary" /> Calories</div>
                <div className="text-4xl font-semibold mt-1">{targets.kcal.toLocaleString()} <span className="text-base font-normal text-muted-foreground">kcal / day</span></div>
                <div className="grid grid-cols-3 gap-3 mt-5">
                  {[
                    { l: "Protein", v: targets.protein_g, n: "1.8 g per kg" },
                    { l: "Carbs", v: targets.carbs_g, n: "Training fuel" },
                    { l: "Fat", v: targets.fat_g, n: "25% of calories" },
                  ].map((m) => (
                    <div key={m.l} className="rounded-lg bg-muted p-3">
                      <div className="text-xs text-muted-foreground">{m.l}</div>
                      <div className="text-xl font-semibold">{m.v} g</div>
                      <div className="text-[11px] text-muted-foreground">{m.n}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Droplets className="size-4 text-primary" /> Water</div>
                <div className="text-3xl font-semibold mt-1">{water.baselineMl.toLocaleString()} <span className="text-base font-normal text-muted-foreground">ml / day</span></div>
                <p className="text-xs text-muted-foreground mt-2">Rises automatically on hard days: +60 ml per point of WHOOP strain.</p>
              </CardContent>
            </Card>
          </section>
        )}

        <div className="flex items-center justify-between mt-10">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="size-4" /> Back</Button>
          ) : <span />}
          {step < 4 ? (
            <Button onClick={next} disabled={save.isPending}>
              {step === 3 ? "Continue" : "Next"} <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={save.isPending || !targets}>
              {save.isPending ? "Saving…" : "Enter Cove"} <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
