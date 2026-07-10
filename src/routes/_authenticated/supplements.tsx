import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useState } from "react";
import { Pill, X, Plus, Pencil, Info, Circle, CheckCircle2, Sunrise, Sun, Sunset, Moon, Clock, Flame } from "lucide-react";
import { today, fmtDate } from "@/lib/recovery";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { getSupplementStats } from "@/lib/supplements.functions";
import { TIME_OF_DAY, type TimeOfDay, groupByTimeOfDay } from "@/lib/supplements.shared";

const TIME_META: Record<TimeOfDay, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  morning: { label: "Morning", icon: Sunrise },
  afternoon: { label: "Afternoon", icon: Sun },
  evening: { label: "Evening", icon: Sunset },
  night: { label: "Night", icon: Moon },
  anytime: { label: "Anytime", icon: Clock },
};

const UNITS = ["mg", "mcg", "g", "IU", "%DV"] as const;
type Unit = (typeof UNITS)[number];

const nutrientSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(40, "Max 40 chars"),
  amount: z
    .string()
    .trim()
    .refine((v) => v !== "" && Number.isFinite(Number(v)) && Number(v) > 0, "Must be > 0"),
  unit: z.enum(UNITS),
});

const numberInRange = (min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => v == null || v === "" || (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max),
      `Must be between ${min} and ${max}`,
    );

const supplementSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(60, "Max 60 chars"),
  brand: z.string().trim().max(60, "Max 60 chars").optional(),
  servingSize: z.string().trim().max(30, "Max 30 chars").optional(),
  calories: numberInRange(0, 2000),
  protein: numberInRange(0, 500),
  carbs: numberInRange(0, 500),
  fat: numberInRange(0, 500),
  notes: z.string().max(500, "Max 500 chars").optional(),
  nutrients: z.array(nutrientSchema),
  timeOfDay: z.enum(TIME_OF_DAY).nullable().optional(),
});

export const Route = createFileRoute("/_authenticated/supplements")({
  component: SupplementsPage,
});

type Nutrient = { name: string; amount: string; unit: string };

type Supplement = {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  serving_size: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
  nutrients: Nutrient[] | null;
  time_of_day: string | null;
};

function SupplementsPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(today());
  const [editing, setEditing] = useState<Supplement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState<Supplement | null>(null);
  const isToday = date === today();

  const { data: supps } = useQuery({
    queryKey: ["supplements"],
    queryFn: async () => {
      const { data } = await supabase.from("user_supplements").select("*").order("name");
      return (data ?? []) as unknown as Supplement[];
    },
  });

  const statsFn = useServerFn(getSupplementStats);
  const { data: stats } = useQuery({
    queryKey: ["supplement-stats"],
    queryFn: () => statsFn({ data: undefined as any }),
  });
  const statMap = new Map((stats ?? []).map((s) => [s.id, s]));

  const { data: todayHabits } = useQuery({
    queryKey: ["habits", date],
    queryFn: async () => {
      const { data } = await supabase.from("habits_log").select("*").eq("entry_date", date).maybeSingle();
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["supplements-history"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const { data } = await supabase
        .from("habits_log")
        .select("entry_date,supplements")
        .gte("entry_date", since.toISOString().slice(0, 10))
        .order("entry_date", { ascending: false });
      return (data ?? []).filter((d) => (d.supplements ?? []).length > 0);
    },
  });

  const taken = new Set<string>(todayHabits?.supplements ?? []);

  const setTaken = useMutation({
    mutationFn: async (names: string[]) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("habits_log").upsert(
        {
          user_id: u.user!.id,
          entry_date: date,
          supplements: names,
        },
        { onConflict: "user_id,entry_date" },
      );
      if (error) throw error;
    },
    onMutate: async (names: string[]) => {
      await qc.cancelQueries({ queryKey: ["habits", date] });
      const prev = qc.getQueryData<any>(["habits", date]);
      qc.setQueryData(["habits", date], { ...(prev ?? {}), supplements: names });
      return { prev };
    },
    onError: (e, _names, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(["habits", date], ctx.prev);
      toast.error((e as Error).message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["habits", date] });
      qc.invalidateQueries({ queryKey: ["supplements-history"] });
    },
  });

  function toggleOne(name: string) {
    const current = new Set<string>(todayHabits?.supplements ?? []);
    if (current.has(name)) current.delete(name);
    else current.add(name);
    setTaken.mutate(Array.from(current));
  }


  const delSupp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_supplements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplements"] }),
  });

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(s: Supplement) {
    setEditing(s);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Pill className="size-6 sm:size-7 text-primary shrink-0" /> Supplements
          </h1>
          <p className="text-muted-foreground text-sm">Tap to log what you've taken {isToday ? "today" : "that day"}.</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Viewing date</Label>
          <div className="flex items-center gap-2">
            {!isToday && (
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
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{isToday ? "Taken today" : "Taken"} — {fmtDate(date)}</CardTitle>
            <CardDescription>
              {(supps ?? []).length === 0
                ? "Add a supplement below, then tap it here to log."
                : `${taken.size} of ${(supps ?? []).length} taken · tap a tile to mark taken, tap again to undo`}
            </CardDescription>
          </div>
          {(supps ?? []).length >= 2 && (
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTaken.mutate((supps ?? []).map((s) => s.name))}
                disabled={taken.size === (supps ?? []).length}
              >
                Mark all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTaken.mutate([])}
                disabled={taken.size === 0}
              >
                Clear
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {(supps ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing in your list yet.</p>
          ) : (
            (() => {
              const anyTagged = (supps ?? []).some((s) => !!s.time_of_day);
              const groups = anyTagged
                ? groupByTimeOfDay(supps ?? [])
                : [{ key: "anytime" as TimeOfDay, items: supps ?? [] }];
              return (
                <div className="space-y-4">
                  {groups.map((g) => {
                    const Meta = TIME_META[g.key];
                    const IconC = Meta.icon;
                    return (
                      <div key={g.key}>
                        {anyTagged && (
                          <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <IconC className="size-3.5" /> {Meta.label}
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {g.items.map((s) => (
                            <SuppTile
                              key={s.id}
                              s={s}
                              on={taken.has(s.name)}
                              onToggle={() => toggleOne(s.name)}
                              onInfo={() => setInfoOpen(s)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Manage your list</CardTitle>
            <CardDescription>Save each supplement once with its nutritional info — reuse it any day.</CardDescription>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(supps ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">None yet. Click "Add" to create your first one.</p>
          )}
          {(supps ?? []).map((s) => {
            const macroBits = [
              s.serving_size && `Serving: ${s.serving_size}`,
              s.calories != null && `${s.calories} kcal`,
              s.protein_g != null && `P ${s.protein_g}g`,
              s.carbs_g != null && `C ${s.carbs_g}g`,
              s.fat_g != null && `F ${s.fat_g}g`,
            ].filter(Boolean);
            const st = statMap.get(s.id);
            const timeKey = (s.time_of_day && (TIME_OF_DAY as readonly string[]).includes(s.time_of_day)
              ? s.time_of_day
              : null) as TimeOfDay | null;
            const TimeIcon = timeKey ? TIME_META[timeKey].icon : null;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate flex items-center gap-1.5">
                    {s.name}
                    {s.brand && <span className="text-muted-foreground font-normal"> · {s.brand}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {timeKey && TimeIcon && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-secondary text-secondary-foreground">
                        <TimeIcon className="size-3" /> {TIME_META[timeKey].label}
                      </span>
                    )}
                    {st && st.logged_days_30 >= 3 && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px]",
                          st.adherence_pct_30 >= 80
                            ? "bg-[color:var(--recovery-high)]/15 text-[color:var(--recovery-high)]"
                            : st.adherence_pct_30 >= 50
                              ? "bg-[color:var(--recovery-mid)]/15 text-[color:var(--recovery-mid)]"
                              : "bg-[color:var(--recovery-low)]/15 text-[color:var(--recovery-low)]",
                        )}
                        title={`Taken ${st.taken_days_30} of ${st.logged_days_30} logged days`}
                      >
                        {st.adherence_pct_30}% · 30d
                      </span>
                    )}
                    {st && st.streak_days >= 2 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-orange-500/15 text-orange-600 dark:text-orange-400">
                        <Flame className="size-3" /> {st.streak_days}d
                      </span>
                    )}
                  </div>
                  {macroBits.length > 0 && (
                    <div className="text-xs text-muted-foreground truncate mt-1">{macroBits.join(" · ")}</div>
                  )}
                  {(s.nutrients?.length ?? 0) > 0 && (
                    <div className="text-xs text-muted-foreground truncate">
                      {s.nutrients!.map((n) => `${n.name} ${n.amount}${n.unit}`).join(", ")}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Delete "${s.name}"?`)) delSupp.mutate(s.id);
                    }}
                    title="Delete"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent history</CardTitle>
          <CardDescription>Last 14 days</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(history ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No supplements logged in the last 14 days.</p>
          )}
          {(history ?? []).map((d) => (
            <div key={d.entry_date} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0">
              <div className="text-sm font-medium w-28 shrink-0">{fmtDate(d.entry_date)}</div>
              <div className="flex flex-wrap gap-1.5 flex-1 justify-end">
                {(d.supplements ?? []).map((s: string) => (
                  <span key={s} className="px-2 py-0.5 rounded-full text-xs bg-accent text-accent-foreground">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <SupplementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        date={date}
        alreadyTaken={taken}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["supplements"] });
          qc.invalidateQueries({ queryKey: ["habits", date] });
          qc.invalidateQueries({ queryKey: ["supplements-history"] });
          qc.invalidateQueries({ queryKey: ["supplement-stats"] });
        }}
      />


      <InfoDialog supplement={infoOpen} onClose={() => setInfoOpen(null)} />
    </div>
  );
}

function SupplementDialog({
  open,
  onOpenChange,
  editing,
  date,
  alreadyTaken,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Supplement | null;
  date: string;
  alreadyTaken: Set<string>;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [servingSize, setServingSize] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [notes, setNotes] = useState("");
  const [nutrients, setNutrients] = useState<Nutrient[]>([]);
  const [markTakenToday, setMarkTakenToday] = useState(true);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});


  // Reset fields when dialog opens with a different target
  const [openedKey, setOpenedKey] = useState<string>("");
  const targetKey = `${open ? "1" : "0"}-${editing?.id ?? "new"}`;
  if (open && targetKey !== openedKey) {
    setOpenedKey(targetKey);
    setName(editing?.name ?? "");
    setBrand(editing?.brand ?? "");
    setServingSize(editing?.serving_size ?? "");
    setCalories(editing?.calories?.toString() ?? "");
    setProtein(editing?.protein_g?.toString() ?? "");
    setCarbs(editing?.carbs_g?.toString() ?? "");
    setFat(editing?.fat_g?.toString() ?? "");
    setNotes(editing?.notes ?? "");
    setNutrients(
      (editing?.nutrients ?? []).map((n) => ({
        name: n.name,
        amount: n.amount,
        unit: (UNITS as readonly string[]).includes(n.unit) ? n.unit : "mg",
      })),
    );
    // For new items, default to "taken today". For edits, default to current state.
    setMarkTakenToday(editing ? alreadyTaken.has(editing.name) : true);
    setErrors({});
  }


  const save = useMutation({
    mutationFn: async () => {
      const parsed = supplementSchema.safeParse({
        name,
        brand,
        servingSize,
        calories,
        protein,
        carbs,
        fat,
        notes,
        nutrients,
      });
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          errs[issue.path.join(".")] = issue.message;
        }
        setErrors(errs);
        throw new Error("Please fix the highlighted fields");
      }
      setErrors({});

      const { data: u } = await supabase.auth.getUser();

      // Duplicate-name guard (case-insensitive, scoped to current user)
      const trimmedName = parsed.data.name;
      const { data: dupes } = await supabase
        .from("user_supplements")
        .select("id,name")
        .eq("user_id", u.user!.id)
        .ilike("name", trimmedName);
      const conflict = (dupes ?? []).find((d) => d.id !== editing?.id);
      if (conflict) {
        throw new Error(`You already have "${conflict.name}" — edit that one instead.`);
      }

      const payload: any = {
        user_id: u.user!.id,
        name: trimmedName,
        brand: parsed.data.brand?.trim() || null,
        serving_size: parsed.data.servingSize?.trim() || null,
        calories: parsed.data.calories ? parseFloat(parsed.data.calories) : null,
        protein_g: parsed.data.protein ? parseFloat(parsed.data.protein) : null,
        carbs_g: parsed.data.carbs ? parseFloat(parsed.data.carbs) : null,
        fat_g: parsed.data.fat ? parseFloat(parsed.data.fat) : null,
        notes: parsed.data.notes?.trim() || null,
        nutrients: parsed.data.nutrients,
      };
      if (editing) {
        const { error } = await supabase.from("user_supplements").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_supplements").insert(payload);
        if (error) throw error;
      }

      // Update today's taken list based on the checkbox
      const { data: existing } = await supabase
        .from("habits_log")
        .select("supplements")
        .eq("user_id", u.user!.id)
        .eq("entry_date", date)
        .maybeSingle();
      const current = new Set<string>(existing?.supplements ?? []);
      // If renaming an edited item, remove the old name
      if (editing && editing.name !== trimmedName) current.delete(editing.name);
      if (markTakenToday) current.add(trimmedName);
      else current.delete(trimmedName);
      const { error: hErr } = await supabase.from("habits_log").upsert(
        {
          user_id: u.user!.id,
          entry_date: date,
          supplements: Array.from(current),
        },
        { onConflict: "user_id,entry_date" },
      );
      if (hErr) throw hErr;
    },

    onSuccess: () => {
      toast.success(editing ? "Supplement updated" : "Supplement saved");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function addNutrient() {
    setNutrients([...nutrients, { name: "", amount: "", unit: "mg" }]);
  }
  function updateNutrient(i: number, patch: Partial<Nutrient>) {
    setNutrients(nutrients.map((n, idx) => (idx === i ? { ...n, ...patch } : n)));
  }
  function removeNutrient(i: number) {
    setNutrients(nutrients.filter((_, idx) => idx !== i));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit supplement" : "Add supplement"}</DialogTitle>
          <DialogDescription>
            Save it once with its nutrition info — it'll appear as a chip you can re-use any day.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Magnesium glycinate"
                maxLength={60}
                aria-invalid={!!errors.name}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label className="text-xs">Brand</Label>
              <Input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="optional"
                maxLength={60}
                aria-invalid={!!errors.brand}
                className={errors.brand ? "border-destructive" : ""}
              />
              {errors.brand && <p className="text-xs text-destructive mt-1">{errors.brand}</p>}
            </div>
            <div>
              <Label className="text-xs">Serving size</Label>
              <Input
                value={servingSize}
                onChange={(e) => setServingSize(e.target.value)}
                placeholder="1 capsule"
                maxLength={30}
                aria-invalid={!!errors.servingSize}
                className={errors.servingSize ? "border-destructive" : ""}
              />
              {errors.servingSize && <p className="text-xs text-destructive mt-1">{errors.servingSize}</p>}
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Per serving</Label>
            <div className="grid grid-cols-4 gap-2 mt-1.5">
              <FieldSmall label="kcal" value={calories} onChange={setCalories} error={errors.calories} />
              <FieldSmall label="Protein (g)" value={protein} onChange={setProtein} error={errors.protein} />
              <FieldSmall label="Carbs (g)" value={carbs} onChange={setCarbs} error={errors.carbs} />
              <FieldSmall label="Fat (g)" value={fat} onChange={setFat} error={errors.fat} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nutrients</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addNutrient}>
                <Plus className="size-3.5" /> Add
              </Button>
            </div>
            {nutrients.length === 0 && (
              <p className="text-xs text-muted-foreground">No nutrients added. Click "Add" to track vitamins, minerals, etc.</p>
            )}
            <div className="space-y-2">
              {nutrients.map((n, i) => {
                const nameErr = errors[`nutrients.${i}.name`];
                const amountErr = errors[`nutrients.${i}.amount`];
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex gap-2 items-start">
                      <Input
                        value={n.name}
                        onChange={(e) => updateNutrient(i, { name: e.target.value })}
                        placeholder="Vitamin D"
                        maxLength={40}
                        aria-invalid={!!nameErr}
                        className={cn("flex-1", nameErr && "border-destructive")}
                      />
                      <Input
                        value={n.amount}
                        onChange={(e) => updateNutrient(i, { amount: e.target.value })}
                        placeholder="1000"
                        inputMode="decimal"
                        aria-invalid={!!amountErr}
                        className={cn("w-20", amountErr && "border-destructive")}
                      />
                      <Select
                        value={n.unit}
                        onValueChange={(v) => updateNutrient(i, { unit: v as Unit })}
                      >
                        <SelectTrigger className="w-[5.5rem]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeNutrient(i)}>
                        <X className="size-4" />
                      </Button>
                    </div>
                    {(nameErr || amountErr) && (
                      <p className="text-xs text-destructive pl-1">{nameErr || amountErr}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>


          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="When to take, with food, etc." />
          </div>

          <label className="flex items-center gap-2.5 rounded-md border border-border bg-accent/40 px-3 py-2.5 cursor-pointer">
            <Checkbox
              checked={markTakenToday}
              onCheckedChange={(v) => setMarkTakenToday(v === true)}
            />
            <div className="text-sm">
              <div className="font-medium">Mark as taken today</div>
              <div className="text-xs text-muted-foreground">
                Adds this to today's log right away. You can always tap the tile to undo.
              </div>
            </div>
          </label>



          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving..." : editing ? "Save changes" : "Add supplement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldSmall({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={cn("mt-1", error && "border-destructive")}
      />
      {error && <p className="text-[10px] text-destructive mt-0.5">{error}</p>}
    </div>
  );
}

function InfoDialog({ supplement, onClose }: { supplement: Supplement | null; onClose: () => void }) {
  const s = supplement;
  return (
    <Dialog open={!!s} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        {s && (
          <>
            <DialogHeader>
              <DialogTitle>{s.name}</DialogTitle>
              {s.brand && <DialogDescription>{s.brand}</DialogDescription>}
            </DialogHeader>
            <div className="space-y-3 text-sm">
              {s.serving_size && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Serving</div>
                  <div>{s.serving_size}</div>
                </div>
              )}
              {(s.calories != null || s.protein_g != null || s.carbs_g != null || s.fat_g != null) && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Per serving</div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <Stat label="kcal" value={s.calories} />
                    <Stat label="P" value={s.protein_g} suffix="g" />
                    <Stat label="C" value={s.carbs_g} suffix="g" />
                    <Stat label="F" value={s.fat_g} suffix="g" />
                  </div>
                </div>
              )}
              {(s.nutrients?.length ?? 0) > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Nutrients</div>
                  <ul className="space-y-1">
                    {s.nutrients!.map((n, i) => (
                      <li key={i} className="flex justify-between border-b border-border/50 pb-1">
                        <span>{n.name}</span>
                        <span className="font-medium tabular-nums">
                          {n.amount} {n.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {s.notes && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Notes</div>
                  <div className="whitespace-pre-wrap">{s.notes}</div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
  return (
    <div className="bg-muted rounded-md py-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums text-sm">
        {value == null ? "—" : `${value}${suffix ?? ""}`}
      </div>
    </div>
  );
}
