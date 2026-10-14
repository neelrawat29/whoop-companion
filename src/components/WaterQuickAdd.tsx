import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Droplets, Check } from "lucide-react";
import { toast } from "sonner";
import { computeWaterTarget, WATER_QUICK_ADDS } from "@/lib/targets.shared";

/** Home card: personalised water target + one-tap quick-add chips (ml). */
export function WaterQuickAdd({ date, profile, habits }: { date: string; profile: any; habits: any }) {
  const qc = useQueryClient();
  const current = Number(habits?.hydration ?? 0);
  const t = computeWaterTarget({ weight_kg: profile?.weight_kg, sex: profile?.sex, strain: habits?.strain });
  const remaining = Math.max(0, t.targetMl - current);
  const pct = Math.min(100, Math.round((current / t.targetMl) * 100));

  const add = useMutation({
    mutationFn: async (ml: number) => {
      const { data: u } = await supabase.auth.getUser();
      // Re-read the saved value so rapid taps / other devices never get overwritten.
      const { data: row } = await supabase.from("habits_log").select("hydration").eq("entry_date", date).maybeSingle();
      const next = Math.max(0, Number(row?.hydration ?? 0) + ml);
      const { error } = await supabase
        .from("habits_log")
        .upsert({ user_id: u.user!.id, entry_date: date, hydration: next } as any, { onConflict: "user_id,entry_date" });
      if (error) throw error;
      return next;
    },
    onSuccess: (next, ml) => {
      qc.setQueryData(["habits", date], (old: any) => ({ ...(old ?? {}), hydration: next }));
      toast.success(`+${ml} ml · ${(next / 1000).toFixed(2)} L today`);
      qc.invalidateQueries({ queryKey: ["habits", date] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium flex items-center gap-2"><Droplets className="size-4 text-primary" /> Water</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Target {(t.targetMl / 1000).toFixed(1)} L — {(t.baselineMl / 1000).toFixed(1)} L base
              {t.strainBonusMl > 0 && ` + ${t.strainBonusMl} ml for strain`}
              {!profile?.weight_kg && " (add your weight in Settings to personalise)"}
            </p>
          </div>
          <p className="text-lg font-semibold tabular-nums shrink-0">
            {(current / 1000).toFixed(2)}<span className="text-xs text-muted-foreground"> / {(t.targetMl / 1000).toFixed(1)} L</span>
          </p>
        </div>
        <Progress value={pct} />
        <div className="flex flex-wrap gap-2">
          {WATER_QUICK_ADDS.map((q) => (
            <Button key={q.ml} size="sm" variant="outline" disabled={add.isPending} onClick={() => add.mutate(q.ml)}>
              +{q.ml} ml <span className="text-muted-foreground ml-1 text-xs">{q.label}</span>
            </Button>
          ))}
          <Button size="sm" disabled={add.isPending || remaining === 0} onClick={() => add.mutate(remaining)}>
            <Check className="size-4" /> {remaining === 0 ? "Target met" : "Hit target"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
