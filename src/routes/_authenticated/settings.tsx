import { createFileRoute, Link } from "@tanstack/react-router";
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
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { z } from "zod";
import { Sparkles } from "lucide-react";

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

  if (profile && !hydrated) {
    setPush(profile.threshold_push?.toString() ?? "67");
    setRest(profile.threshold_rest?.toString() ?? "34");
    setName(profile.display_name ?? "");
    setDob((profile as any).date_of_birth ?? "");
    setSex((profile as any).sex ?? "");
    setHeight((profile as any).height_cm?.toString() ?? "");
    setWeight((profile as any).weight_kg?.toString() ?? "");
    setRhrBase((profile as any).resting_hr_baseline?.toString() ?? "");
    setHydrated(true);
  }

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
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["profile"] }); },
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
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile & thresholds</CardTitle>
          <CardDescription>Recovery thresholds for the training recommendation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>Save</Button>
        </CardContent>
      </Card>

      <Card>
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
          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-1.5 col-span-2">
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
          <Button onClick={() => saveBaseline.mutate()} disabled={saveBaseline.isPending}>
            {saveBaseline.isPending ? "Saving…" : "Save baseline"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={exportData}>Download my data (JSON)</Button>
        </CardContent>
      </Card>
    </div>
  );
}
