import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { UtensilsCrossed, Sparkles, Trash2, Plus } from "lucide-react";
import { today, fmtDate } from "@/lib/recovery";
import { estimateMeal } from "@/lib/meals.functions";

export const Route = createFileRoute("/_authenticated/meals")({
  component: MealsPage,
});

const FIXED_SLOTS = ["breakfast", "lunch", "dinner"] as const;

type Meal = {
  id: string;
  slot: string;
  description: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  source: string;
};

function MealsPage() {
  const date = today();
  const qc = useQueryClient();

  const { data: meals } = useQuery({
    queryKey: ["meals", date],
    queryFn: async () => {
      const { data } = await supabase
        .from("meals")
        .select("*")
        .eq("entry_date", date)
        .order("created_at");
      return (data ?? []) as Meal[];
    },
  });

  const totals = useMemo(() => {
    const t = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    for (const m of meals ?? []) {
      t.kcal += m.kcal ?? 0;
      t.protein_g += m.protein_g ?? 0;
      t.carbs_g += m.carbs_g ?? 0;
      t.fat_g += m.fat_g ?? 0;
    }
    return t;
  }, [meals]);

  const snacks = (meals ?? []).filter((m) => m.slot === "snack");

  const addSnack = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("meals").insert({
        user_id: u.user!.id,
        entry_date: date,
        slot: "snack",
        description: "",
        source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals", date] }),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <UtensilsCrossed className="size-7 text-primary" /> Meals
        </h1>
        <p className="text-muted-foreground text-sm">{fmtDate(date)} — AI-estimated, fully editable.</p>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>Today's intake</CardDescription>
          <CardTitle className="text-3xl">{totals.kcal} kcal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Macro label="Protein" value={`${totals.protein_g.toFixed(0)}g`} />
            <Macro label="Carbs" value={`${totals.carbs_g.toFixed(0)}g`} />
            <Macro label="Fat" value={`${totals.fat_g.toFixed(0)}g`} />
          </div>
        </CardContent>
      </Card>

      {FIXED_SLOTS.map((slot) => (
        <MealSlot
          key={slot}
          date={date}
          slot={slot}
          meal={(meals ?? []).find((m) => m.slot === slot)}
        />
      ))}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base capitalize">Snacks</CardTitle>
            <Button size="sm" variant="outline" onClick={() => addSnack.mutate()}>
              <Plus className="size-4 mr-1" /> Add snack
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {snacks.length === 0 && (
            <p className="text-sm text-muted-foreground">No snacks logged yet.</p>
          )}
          {snacks.map((m) => (
            <MealSlot key={m.id} date={date} slot="snack" meal={m} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function MealSlot({
  date,
  slot,
  meal,
}: {
  date: string;
  slot: string;
  meal?: Meal;
}) {
  const qc = useQueryClient();
  const estimate = useServerFn(estimateMeal);
  const [description, setDescription] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [estimating, setEstimating] = useState(false);

  useEffect(() => {
    if (meal) {
      setDescription(meal.description ?? "");
      setKcal(meal.kcal?.toString() ?? "");
      setProtein(meal.protein_g?.toString() ?? "");
      setCarbs(meal.carbs_g?.toString() ?? "");
      setFat(meal.fat_g?.toString() ?? "");
    }
  }, [meal]);

  async function runEstimate() {
    if (!description.trim()) {
      toast.error("Describe what you ate first");
      return;
    }
    setEstimating(true);
    try {
      const r = await estimate({ data: { description } });
      if (r.kcal != null) setKcal(String(r.kcal));
      if (r.protein_g != null) setProtein(String(r.protein_g));
      if (r.carbs_g != null) setCarbs(String(r.carbs_g));
      if (r.fat_g != null) setFat(String(r.fat_g));
      toast.success("Estimated — edit any value below");
    } catch (e: any) {
      toast.error(e.message ?? "Estimate failed");
    } finally {
      setEstimating(false);
    }
  }

  const save = useMutation({
    mutationFn: async (source: "ai" | "manual") => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        user_id: u.user!.id,
        entry_date: date,
        slot,
        description,
        kcal: kcal ? parseInt(kcal) : null,
        protein_g: protein ? parseFloat(protein) : null,
        carbs_g: carbs ? parseFloat(carbs) : null,
        fat_g: fat ? parseFloat(fat) : null,
        source,
      };
      if (meal?.id) {
        const { error } = await supabase.from("meals").update(payload).eq("id", meal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("meals").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["meals", date] });
    },
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!meal?.id) return;
      const { error } = await supabase.from("meals").delete().eq("id", meal.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals", date] }),
  });

  const isSnack = slot === "snack";

  const body = (
    <div className="space-y-3">
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={
          slot === "breakfast"
            ? "e.g. 2 eggs, sourdough toast, black coffee"
            : slot === "lunch"
              ? "e.g. chicken caesar salad, sparkling water"
              : slot === "dinner"
                ? "e.g. grilled salmon, rice, broccoli"
                : "e.g. apple and a handful of almonds"
        }
        rows={2}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={runEstimate} disabled={estimating}>
          <Sparkles className="size-4 mr-1.5" />
          {estimating ? "Estimating..." : "AI estimate"}
        </Button>
        <Button type="button" size="sm" onClick={() => save.mutate("manual")} disabled={save.isPending}>
          Save
        </Button>
        {meal?.id && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => del.mutate()}
            className="text-muted-foreground"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Num label="kcal" value={kcal} onChange={setKcal} />
        <Num label="Protein g" value={protein} onChange={setProtein} />
        <Num label="Carbs g" value={carbs} onChange={setCarbs} />
        <Num label="Fat g" value={fat} onChange={setFat} />
      </div>
      {meal?.source === "ai" && (
        <p className="text-xs text-muted-foreground">AI estimate — edit any value if it's off.</p>
      )}
    </div>
  );

  if (isSnack) {
    return <div className="border border-border rounded-lg p-4">{body}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base capitalize">{slot}</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

function Num({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
