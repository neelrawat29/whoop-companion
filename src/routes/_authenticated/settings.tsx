import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { z } from "zod";
import { Sparkles, Shield, Target, AlertTriangle } from "lucide-react";
import { SaveBar, useSaveFlash, flashRingClasses } from "@/components/save-bar";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { getMyTargets, saveMyTargets } from "@/lib/targets.functions";
import { eraseMyData, deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const baselineSchema = z.object({
  date_of_birth: z
    .string()
    .optional()
    .refine((v) => !v || new Date(v) < new Date(), { message: "Must be in the past" }),
  sex: z.enum(["male", "female", "other"]).optional().or(z.literal("")),
  height_cm: z.string().optional().refine((v) => !v || (Number(v) >= 100 && Number(v) <= 250), { message: "100–250cm" }),
  weight_kg: z.string().optional().refine((v) => !v || (Number(v) >= 30 && Number(v) <= 300), { message: "30–300kg" }),
  resting_hr_baseline: z.string().optional().refine((v) => !v || (Number(v) >= 30 && Number(v) <= 120), { message: "30–120 bpm" }),
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").maybeSingle();
      return data;
    },
  });

  const [push, setPush] = useState("");
  const [rest, setRest] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState<string>("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [rhrBase, setRhrBase] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [initialProfile, setInitialProfile] = useState({ push: "", rest: "", name: "" });
  const [initialBaseline, setInitialBaseline] = useState({ dob: "", sex: "", height: "", weight: "", rhrBase: "" });
  const [profileSavedAt, setProfileSavedAt] = useState<Date | null>(null);
  const [baselineSavedAt, setBaselineSavedAt] = useState<Date | null>(null);
  const profileFlash = useSaveFlash();
  const baselineFlash = useSaveFlash();

  if (profile && !hydrated) {
    const p = {
      push: profile.threshold_push?.toString() ?? "67",
      rest: profile.threshold_rest?.toString() ?? "34",
      name: profile.display_name ?? "",
    };
    const b = {
      dob: (profile as any).date_of_birth ?? "",
      sex: (profile as any).sex ?? "",
      height: (profile as any).height_cm?.toString() ?? "",
      weight: (profile as any).weight_kg?.toString() ?? "",
      rhrBase: (profile as any).resting_hr_baseline?.toString() ?? "",
    };
    setPush(p.push); setRest(p.rest); setName(p.name);
    setDob(b.dob); setSex(b.sex); setHeight(b.height); setWeight(b.weight); setRhrBase(b.rhrBase);
    setInitialProfile(p);
    setInitialBaseline(b);
    const ts = (profile as any).updated_at ? new Date((profile as any).updated_at) : null;
    setProfileSavedAt(ts);
    setBaselineSavedAt(ts);
    setHydrated(true);
  }

  const profileDirty =
    push !== initialProfile.push ||
    rest !== initialProfile.rest ||
    name !== initialProfile.name;
  const baselineDirty =
    dob !== initialBaseline.dob ||
    sex !== initialBaseline.sex ||
    height !== initialBaseline.height ||
    weight !== initialBaseline.weight ||
    rhrBase !== initialBaseline.rhrBase;

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("profiles").update({
        threshold_push: parseInt(push) || 67,
        threshold_rest: parseInt(rest) || 34,
        display_name: name || null,
      }).eq("id", u.user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      setInitialProfile({ push, rest, name });
      setProfileSavedAt(new Date());
      profileFlash.trigger();
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const saveBaseline = useMutation({
    mutationFn: async () => {
      const parsed = baselineSchema.safeParse({
        date_of_birth: dob,
        sex,
        height_cm: height,
        weight_kg: weight,
        resting_hr_baseline: rhrBase,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
      }
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("profiles")
        .update({
          date_of_birth: dob || null,
          sex: (sex || null) as any,
          height_cm: height ? Number(height) : null,
          weight_kg: weight ? Number(weight) : null,
          resting_hr_baseline: rhrBase ? Number(rhrBase) : null,
        } as any)
        .eq("id", u.user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Baseline saved");
      setInitialBaseline({ dob, sex, height, weight, rhrBase });
      setBaselineSavedAt(new Date());
      baselineFlash.trigger();
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["bio-age"] });
      qc.invalidateQueries({ queryKey: ["bio-age-history"] });
    },
    onError: (e) => toast.error(e.message),
  });

  async function exportData() {
    const [entries, habits] = await Promise.all([
      supabase.from("daily_entries").select("*").order("entry_date"),
      supabase.from("habits_log").select("*").order("entry_date"),
    ]);
    const blob = new Blob([JSON.stringify({ entries: entries.data, habits: habits.data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whoop-companion-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
      </div>

      <Card className={cn("transition-shadow", profileFlash.flash && flashRingClasses)}>
        <CardHeader>
          <CardTitle className="text-base">Profile & thresholds</CardTitle>
          <CardDescription>Recovery thresholds for the training recommendation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); saveProfile.mutate(); }} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Push if recovery ≥</Label>
                <Input type="number" value={push} onChange={(e) => setPush(e.target.value)} min={0} max={100} />
              </div>
              <div className="space-y-1.5">
                <Label>Rest if recovery &lt;</Label>
                <Input type="number" value={rest} onChange={(e) => setRest(e.target.value)} min={0} max={100} />
              </div>
            </div>
            <SaveBar
              isDirty={profileDirty}
              isPending={saveProfile.isPending}
              isSaved={hydrated}
              lastSavedAt={profileSavedAt}
              dirtyLabel="Save"
            />
          </form>
        </CardContent>
      </Card>

      <Card className={cn("transition-shadow", baselineFlash.flash && flashRingClasses)}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Body & baseline
          </CardTitle>
          <CardDescription>
            Unlocks your{" "}
            <Link to="/insights/biological-age" className="underline hover:text-foreground">
              Biological Age
            </Link>{" "}
            score. All optional, but more accurate with more inputs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); saveBaseline.mutate(); }} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date of birth</Label>
                <div>
                  <DatePicker
                    value={dob || new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 30).toISOString().slice(0, 10)}
                    onChange={setDob}
                    disableFuture
                    showYear
                    captionLayout="dropdown"
                    startMonth={new Date(1920, 0)}
                    endMonth={new Date()}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Sex</Label>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Height (cm)</Label>
                <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} min={100} max={250} />
              </div>
              <div className="space-y-1.5">
                <Label>Weight (kg)</Label>
                <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} min={30} max={300} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Resting HR baseline (bpm)</Label>
                <Input
                  type="number"
                  value={rhrBase}
                  onChange={(e) => setRhrBase(e.target.value)}
                  min={30}
                  max={120}
                  placeholder="Leave blank to use your logged RHR average"
                />
              </div>
            </div>
            <SaveBar
              isDirty={baselineDirty}
              isPending={saveBaseline.isPending}
              isSaved={hydrated}
              lastSavedAt={baselineSavedAt}
              dirtyLabel="Save baseline"
            />
          </form>
        </CardContent>
      </Card>

      <TargetsCard />



      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={exportData}>Download my data (JSON)</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Shield className="size-4 text-primary" />
          <CardTitle className="text-base">Trust & Privacy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Learn how your data is protected and managed.
          </p>
          <Button variant="outline" asChild>
            <Link to="/trust">View trust page</Link>
          </Button>
        </CardContent>
      </Card>

      <DangerZoneCard />
    </div>
  );
}

function DangerZoneCard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const eraseFn = useServerFn(eraseMyData);
  const deleteFn = useServerFn(deleteMyAccount);

  const [eraseOpen, setEraseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [eraseText, setEraseText] = useState("");
  const [deleteText, setDeleteText] = useState("");

  const erase = useMutation({
    mutationFn: () => eraseFn(),
    onSuccess: async () => {
      toast.success("All data erased");
      setEraseOpen(false);
      setEraseText("");
      await qc.invalidateQueries();
      navigate({ to: "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => deleteFn(),
    onSuccess: async () => {
      toast.success("Account deleted");
      await supabase.auth.signOut();
      qc.clear();
      navigate({ to: "/auth" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-destructive/40">
      <CardHeader className="flex flex-row items-center gap-2">
        <AlertTriangle className="size-4 text-destructive" />
        <CardTitle className="text-base">Danger zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Erase all data</p>
            <p className="text-sm text-muted-foreground">
              Delete every entry, meal, weight, supplement, chat and insight. Your account and groups stay.
            </p>
          </div>
          <AlertDialog open={eraseOpen} onOpenChange={(o) => { setEraseOpen(o); if (!o) setEraseText(""); }}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive">
                Erase data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Erase all your data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes all logs, meals, weights, supplements, chats and insights, and resets your baseline & targets. This cannot be undone. Type <span className="font-mono font-semibold">ERASE</span> to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input value={eraseText} onChange={(e) => setEraseText(e.target.value)} placeholder="ERASE" autoFocus />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={eraseText !== "ERASE" || erase.isPending}
                  onClick={(e) => { e.preventDefault(); erase.mutate(); }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {erase.isPending ? "Erasing…" : "Erase everything"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t">
          <div>
            <p className="text-sm font-medium">Delete account</p>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account, all your data and your group memberships.
            </p>
          </div>
          <AlertDialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) setDeleteText(""); }}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes your account and all associated data. This cannot be undone. Type <span className="font-mono font-semibold">DELETE</span> to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="DELETE" autoFocus />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleteText !== "DELETE" || del.isPending}
                  onClick={(e) => { e.preventDefault(); del.mutate(); }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {del.isPending ? "Deleting…" : "Delete account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

const ACTIVITY_OPTS = [
  { v: "sedentary", l: "Sedentary" },
  { v: "light", l: "Light (1-3x/wk)" },
  { v: "moderate", l: "Moderate (3-5x/wk)" },
  { v: "active", l: "Active (6-7x/wk)" },
  { v: "very_active", l: "Very active (2x/day)" },
];

const GOAL_OPTS = [
  { v: "lose", l: "Lose weight" },
  { v: "maintain", l: "Maintain" },
  { v: "gain", l: "Gain muscle" },
];

function TargetsCard() {
  const qc = useQueryClient();
  const fetchTargets = useServerFn(getMyTargets);
  const saveTargets = useServerFn(saveMyTargets);
  const flash = useSaveFlash();

  const { data: t } = useQuery({ queryKey: ["targets"], queryFn: () => fetchTargets() });

  const [activity, setActivity] = useState("");
  const [goal, setGoal] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [sleep, setSleep] = useState("");
  const [hydrated, setHyd] = useState(false);

  if (t && !hydrated) {
    setActivity(t.activity_level ?? "");
    setGoal(t.goal ?? "");
    setKcal(t.kcal_target?.toString() ?? t.computed?.kcal.toString() ?? "");
    setProtein(t.protein_target?.toString() ?? t.computed?.protein_g.toString() ?? "");
    setCarbs(t.carbs_target?.toString() ?? t.computed?.carbs_g.toString() ?? "");
    setFat(t.fat_target?.toString() ?? t.computed?.fat_g.toString() ?? "");
    setSleep(t.sleep_target_hours?.toString() ?? "8");
    setHyd(true);
  }

  const save = useMutation({
    mutationFn: (autoCompute: boolean) =>
      saveTargets({
        data: {
          activity_level: (activity || null) as any,
          goal: (goal || null) as any,
          kcal_target: kcal ? Number(kcal) : null,
          protein_target: protein ? Number(protein) : null,
          carbs_target: carbs ? Number(carbs) : null,
          fat_target: fat ? Number(fat) : null,
          sleep_target_hours: sleep ? Number(sleep) : null,
          autoCompute,
        },
      }),
    onSuccess: (fresh) => {
      toast.success("Targets saved");
      flash.trigger();
      setKcal(fresh.kcal_target?.toString() ?? "");
      setProtein(fresh.protein_target?.toString() ?? "");
      setCarbs(fresh.carbs_target?.toString() ?? "");
      setFat(fresh.fat_target?.toString() ?? "");
      setSleep(fresh.sleep_target_hours?.toString() ?? "");
      qc.invalidateQueries({ queryKey: ["targets"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className={cn("transition-shadow", flash.flash && flashRingClasses)}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="size-4 text-primary" /> Daily targets
        </CardTitle>
        <CardDescription>
          Powers the rings on your Today screen. Set them manually, or let us compute from your baseline + goal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Activity level</Label>
            <Select value={activity} onValueChange={setActivity}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {ACTIVITY_OPTS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Goal</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {GOAL_OPTS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Calories</Label>
            <Input type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} min={800} max={6000} />
          </div>
          <div className="space-y-1.5">
            <Label>Protein (g)</Label>
            <Input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} min={0} max={500} />
          </div>
          <div className="space-y-1.5">
            <Label>Carbs (g)</Label>
            <Input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} min={0} max={800} />
          </div>
          <div className="space-y-1.5">
            <Label>Fat (g)</Label>
            <Input type="number" value={fat} onChange={(e) => setFat(e.target.value)} min={0} max={300} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Sleep target (hours)</Label>
            <Input type="number" step="0.25" value={sleep} onChange={(e) => setSleep(e.target.value)} min={4} max={12} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={() => save.mutate(false)} disabled={save.isPending}>Save targets</Button>
          <Button variant="outline" onClick={() => save.mutate(true)} disabled={save.isPending}>
            <Sparkles className="size-4 mr-1.5" /> Auto-compute
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

