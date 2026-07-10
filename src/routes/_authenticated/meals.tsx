import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { UtensilsCrossed, Sparkles, Trash2, Plus, Camera, Barcode, Bookmark, History, Loader2 } from "lucide-react";
import { today, fmtDate } from "@/lib/recovery";
import { DatePicker } from "@/components/ui/date-picker";
import {
  estimateMeal,
  estimateMealFromPhoto,
  lookupMealBarcode,
  listMealPresets,
  saveMealPreset,
  deleteMealPreset,
  listRecentMeals,
  type MealPresetDTO,
  type RecentMealDTO,
} from "@/lib/meals.functions";
import { SaveBar, useSaveFlash, flashRingClasses } from "@/components/save-bar";
import { cn } from "@/lib/utils";

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

type Prefill = {
  description: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  assumptions?: string;
  source: "manual" | "ai" | "photo" | "barcode" | "preset";
};

function MealsPage() {
  const [date, setDate] = useState(today());
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="size-6 sm:size-7 text-primary shrink-0" /> Meals
          </h1>
          <p className="text-muted-foreground text-sm">{fmtDate(date)} — AI-estimated, fully editable.</p>
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

      <Card>
        <CardHeader>
          <CardDescription>{date === today() ? "Today's" : "Day's"} intake</CardDescription>
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
  const estimatePhoto = useServerFn(estimateMealFromPhoto);
  const [description, setDescription] = useState("");
  const [portionNotes, setPortionNotes] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [assumptions, setAssumptions] = useState("");
  const [aiSourceForNext, setAiSourceForNext] = useState<"manual" | "ai" | "photo" | "barcode" | "preset">("manual");

  const [snapshot, setSnapshot] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const flash = useSaveFlash();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = meal?.description ?? "";
    const k = meal?.kcal?.toString() ?? "";
    const p = meal?.protein_g?.toString() ?? "";
    const c = meal?.carbs_g?.toString() ?? "";
    const f = meal?.fat_g?.toString() ?? "";
    setDescription(d);
    setKcal(k);
    setProtein(p);
    setCarbs(c);
    setFat(f);
    setSnapshot(JSON.stringify([d, k, p, c, f]));
    setLastSavedAt((meal as any)?.updated_at ? new Date((meal as any).updated_at) : meal ? new Date() : null);
    setAssumptions("");
    setPortionNotes("");
    setAiSourceForNext("manual");
  }, [meal]);

  const current = JSON.stringify([description, kcal, protein, carbs, fat]);
  const isDirty = current !== snapshot;
  const isSaved = !!meal || lastSavedAt !== null;

  function applyPrefill(p: Prefill) {
    setDescription(p.description);
    setKcal(p.kcal);
    setProtein(p.protein);
    setCarbs(p.carbs);
    setFat(p.fat);
    setAssumptions(p.assumptions ?? "");
    setAiSourceForNext(p.source);
  }

  async function runEstimate(opts?: { useCurrentAsHint?: boolean }) {
    if (!description.trim()) {
      toast.error("Describe what you ate first");
      return;
    }
    setEstimating(true);
    try {
      const userKcalHint = opts?.useCurrentAsHint && kcal ? parseInt(kcal) : null;
      const r = await estimate({ data: { description, portionNotes, userKcalHint } });
      if (r.kcal != null) setKcal(String(r.kcal));
      if (r.protein_g != null) setProtein(String(r.protein_g));
      if (r.carbs_g != null) setCarbs(String(r.carbs_g));
      if (r.fat_g != null) setFat(String(r.fat_g));
      setAssumptions(r.assumptions ?? "");
      setAiSourceForNext("ai");
      toast.success(opts?.useCurrentAsHint ? "Re-estimated to your kcal" : "Estimated — edit any value below");
    } catch (e: any) {
      toast.error(e.message ?? "Estimate failed");
    } finally {
      setEstimating(false);
    }
  }

  async function handlePhoto(file: File) {
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Photo too large (max 6 MB)");
      return;
    }
    setEstimating(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const r = await estimatePhoto({
        data: { imageBase64: dataUrl, portionNotes, userKcalHint: null },
      });
      applyPrefill({
        description: r.description || description || "Meal from photo",
        kcal: r.kcal != null ? String(r.kcal) : "",
        protein: r.protein_g != null ? String(r.protein_g) : "",
        carbs: r.carbs_g != null ? String(r.carbs_g) : "",
        fat: r.fat_g != null ? String(r.fat_g) : "",
        assumptions: r.assumptions,
        source: "photo",
      });
      toast.success("Estimated from photo — edit any value below");
    } catch (e: any) {
      toast.error(e.message ?? "Photo estimate failed");
    } finally {
      setEstimating(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const save = useMutation({
    mutationFn: async () => {
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
        source: aiSourceForNext,
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
      setSnapshot(current);
      setLastSavedAt(new Date());
      flash.trigger();
      qc.invalidateQueries({ queryKey: ["meals", date] });
      qc.invalidateQueries({ queryKey: ["recent-meals"] });
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
      <Input
        value={portionNotes}
        onChange={(e) => setPortionNotes(e.target.value)}
        placeholder="Portion notes (optional) — e.g. large bowl ~300g, no oil, double cheese"
        className="text-sm"
      />

      {/* Quick-log action row */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handlePhoto(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={estimating}
          title="Take or pick a meal photo — AI estimates macros"
        >
          <Camera className="size-4 mr-1.5" /> Photo
        </Button>

        <BarcodeButton
          disabled={estimating}
          onPick={(r) => {
            applyPrefill({
              description: [r.brand, r.name].filter(Boolean).join(" — "),
              kcal: r.kcal != null ? String(r.kcal) : "",
              protein: r.protein_g != null ? String(r.protein_g) : "",
              carbs: r.carbs_g != null ? String(r.carbs_g) : "",
              fat: r.fat_g != null ? String(r.fat_g) : "",
              assumptions:
                r.scaled_to === "serving" && r.serving_g
                  ? `From barcode: ${r.name}, per ${r.serving_g} g serving.`
                  : `From barcode: ${r.name}, per 100 g.`,
              source: "barcode",
            });
          }}
        />

        <PresetPicker
          disabled={estimating}
          currentSnapshot={{
            description,
            kcal: kcal ? parseInt(kcal) : null,
            protein_g: protein ? parseFloat(protein) : null,
            carbs_g: carbs ? parseFloat(carbs) : null,
            fat_g: fat ? parseFloat(fat) : null,
          }}
          onPick={(p) => {
            applyPrefill({
              description: p.description || p.name,
              kcal: p.kcal != null ? String(p.kcal) : "",
              protein: p.protein_g != null ? String(p.protein_g) : "",
              carbs: p.carbs_g != null ? String(p.carbs_g) : "",
              fat: p.fat_g != null ? String(p.fat_g) : "",
              assumptions: `From preset: ${p.name}`,
              source: "preset",
            });
          }}
        />

        <RecentPicker
          disabled={estimating}
          onPick={(r) => {
            applyPrefill({
              description: r.description,
              kcal: r.kcal != null ? String(r.kcal) : "",
              protein: r.protein_g != null ? String(r.protein_g) : "",
              carbs: r.carbs_g != null ? String(r.carbs_g) : "",
              fat: r.fat_g != null ? String(r.fat_g) : "",
              assumptions: "Copied from recent meal.",
              source: "manual",
            });
          }}
        />
      </div>

      {/* AI text estimate + save row */}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => runEstimate()} disabled={estimating}>
          {estimating ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Sparkles className="size-4 mr-1.5" />}
          {estimating ? "Estimating..." : "AI estimate"}
        </Button>
        {kcal && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => runEstimate({ useCurrentAsHint: true })}
            disabled={estimating}
            title="Re-estimate macros calibrated to your kcal value"
          >
            Re-estimate to my kcal
          </Button>
        )}
        <SaveBar
          isDirty={isDirty}
          isPending={save.isPending}
          isSaved={isSaved}
          lastSavedAt={lastSavedAt}
          dirtyLabel="Save"
          onClick={() => save.mutate()}
        />
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Num label="kcal" value={kcal} onChange={setKcal} />
        <Num label="Protein g" value={protein} onChange={setProtein} />
        <Num label="Carbs g" value={carbs} onChange={setCarbs} />
        <Num label="Fat g" value={fat} onChange={setFat} />
      </div>
      {assumptions && (
        <p className="text-xs text-muted-foreground italic">{assumptions}</p>
      )}
      {meal?.source && ["ai", "photo", "barcode", "preset"].includes(meal.source) && !assumptions && (
        <p className="text-xs text-muted-foreground">
          {meal.source === "photo"
            ? "Estimated from photo"
            : meal.source === "barcode"
              ? "From barcode"
              : meal.source === "preset"
                ? "From preset"
                : "AI estimate"}{" "}
          — edit any value if it's off.
        </p>
      )}
    </div>
  );

  if (isSnack) {
    return <div className={cn("border border-border rounded-lg p-4 transition-shadow", flash.flash && flashRingClasses)}>{body}</div>;
  }

  return (
    <Card className={cn("transition-shadow", flash.flash && flashRingClasses)}>
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

// ---------------- Barcode entry ----------------

function BarcodeButton({
  disabled,
  onPick,
}: {
  disabled?: boolean;
  onPick: (result: Awaited<ReturnType<typeof lookupMealBarcode>> & object) => void;
}) {
  const lookup = useServerFn(lookupMealBarcode);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const v = code.replace(/\D/g, "");
    if (v.length < 6) {
      toast.error("Enter a valid barcode (6–14 digits)");
      return;
    }
    setBusy(true);
    try {
      const r = await lookup({ data: { barcode: v } });
      if (!r) {
        toast.error("Barcode not found in Open Food Facts");
        return;
      }
      onPick(r);
      setOpen(false);
      setCode("");
    } catch (e: any) {
      toast.error(e.message ?? "Barcode lookup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        <Barcode className="size-4 mr-1.5" /> Barcode
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Look up barcode</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="barcode-input" className="text-xs text-muted-foreground">
            Enter the barcode digits from the package (Open Food Facts)
          </Label>
          <Input
            id="barcode-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. 3017624010701"
            inputMode="numeric"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
            Look up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Presets ----------------

function PresetPicker({
  disabled,
  currentSnapshot,
  onPick,
}: {
  disabled?: boolean;
  currentSnapshot: { description: string; kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null };
  onPick: (p: MealPresetDTO) => void;
}) {
  const list = useServerFn(listMealPresets);
  const save = useServerFn(saveMealPreset);
  const del = useServerFn(deleteMealPreset);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");

  const { data: presets } = useQuery({
    queryKey: ["meal-presets"],
    queryFn: () => list(),
    enabled: open,
  });

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled}>
            <Bookmark className="size-4 mr-1.5" /> Presets
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2 space-y-1" align="start">
          <div className="flex items-center justify-between px-2 pb-1">
            <span className="text-xs font-medium text-muted-foreground">Your presets</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setName(currentSnapshot.description.slice(0, 40) || "New preset");
                setSaveOpen(true);
                setOpen(false);
              }}
            >
              <Plus className="size-3.5 mr-1" /> Save current
            </Button>
          </div>
          {(presets ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground p-2">No presets yet — save your current meal to start.</p>
          )}
          {(presets ?? []).map((p) => (
            <div key={p.id} className="flex items-center gap-1 rounded-md hover:bg-accent">
              <button
                type="button"
                onClick={() => {
                  onPick(p);
                  setOpen(false);
                }}
                className="flex-1 text-left px-2 py-1.5"
              >
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {p.kcal ?? "?"} kcal · P {p.protein_g ?? "?"} · C {p.carbs_g ?? "?"} · F {p.fat_g ?? "?"}
                </div>
              </button>
              <button
                type="button"
                aria-label="Delete preset"
                className="p-2 text-muted-foreground hover:text-destructive"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await del({ data: { id: p.id } });
                    qc.invalidateQueries({ queryKey: ["meal-presets"] });
                  } catch (err: any) {
                    toast.error(err.message ?? "Delete failed");
                  }
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </PopoverContent>
      </Popover>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save meal as preset</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="preset-name" className="text-xs text-muted-foreground">Name</Label>
            <Input
              id="preset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My usual breakfast"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Locks the current macros: {currentSnapshot.kcal ?? "?"} kcal · P {currentSnapshot.protein_g ?? "?"} · C {currentSnapshot.carbs_g ?? "?"} · F {currentSnapshot.fat_g ?? "?"}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!name.trim()) {
                  toast.error("Give the preset a name");
                  return;
                }
                try {
                  await save({
                    data: {
                      name: name.trim(),
                      description: currentSnapshot.description,
                      kcal: currentSnapshot.kcal,
                      protein_g: currentSnapshot.protein_g,
                      carbs_g: currentSnapshot.carbs_g,
                      fat_g: currentSnapshot.fat_g,
                    },
                  });
                  qc.invalidateQueries({ queryKey: ["meal-presets"] });
                  toast.success("Preset saved");
                  setSaveOpen(false);
                } catch (e: any) {
                  toast.error(e.message ?? "Save failed");
                }
              }}
            >
              Save preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------- Recent ----------------

function RecentPicker({
  disabled,
  onPick,
}: {
  disabled?: boolean;
  onPick: (r: RecentMealDTO) => void;
}) {
  const list = useServerFn(listRecentMeals);
  const [open, setOpen] = useState(false);
  const { data: recents } = useQuery({
    queryKey: ["recent-meals"],
    queryFn: () => list(),
    enabled: open,
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          <History className="size-4 mr-1.5" /> Recent
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2 space-y-1" align="start">
        <span className="text-xs font-medium text-muted-foreground px-2 py-1 block">Log again</span>
        {(recents ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground p-2">No recent meals yet.</p>
        )}
        {(recents ?? []).map((r, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              onPick(r);
              setOpen(false);
            }}
            className="w-full text-left rounded-md hover:bg-accent px-2 py-1.5"
          >
            <div className="text-sm truncate">{r.description}</div>
            <div className="text-[11px] text-muted-foreground">
              {r.kcal ?? "?"} kcal · P {r.protein_g ?? "?"} · C {r.carbs_g ?? "?"} · F {r.fat_g ?? "?"}
            </div>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
