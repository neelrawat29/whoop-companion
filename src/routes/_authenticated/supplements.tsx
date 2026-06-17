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
import { toast } from "sonner";
import { useState } from "react";
import { Pill, X, Check, Plus, Pencil, Info } from "lucide-react";
import { today, fmtDate } from "@/lib/recovery";

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
};

function SupplementsPage() {
  const qc = useQueryClient();
  const date = today();
  const [editing, setEditing] = useState<Supplement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState<Supplement | null>(null);

  const { data: supps } = useQuery({
    queryKey: ["supplements"],
    queryFn: async () => {
      const { data } = await supabase.from("user_supplements").select("*").order("name");
      return (data ?? []) as unknown as Supplement[];
    },
  });

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

  const toggleTaken = useMutation({
    mutationFn: async (name: string) => {
      const { data: u } = await supabase.auth.getUser();
      const current = new Set<string>(todayHabits?.supplements ?? []);
      if (current.has(name)) current.delete(name);
      else current.add(name);
      const { error } = await supabase.from("habits_log").upsert(
        {
          user_id: u.user!.id,
          entry_date: date,
          supplements: Array.from(current),
        },
        { onConflict: "user_id,entry_date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits", date] });
      qc.invalidateQueries({ queryKey: ["supplements-history"] });
    },
    onError: (e) => toast.error(e.message),
  });

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Pill className="size-7 text-primary" /> Supplements
        </h1>
        <p className="text-muted-foreground text-sm">Tap to log what you've taken today.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today — {fmtDate(date)}</CardTitle>
          <CardDescription>{taken.size} logged so far</CardDescription>
        </CardHeader>
        <CardContent>
          {(supps ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Add your first supplement below to get started.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {(supps ?? []).map((s) => {
              const on = taken.has(s.name);
              const hasInfo =
                !!s.brand ||
                !!s.serving_size ||
                s.calories != null ||
                s.protein_g != null ||
                s.carbs_g != null ||
                s.fat_g != null ||
                (s.nutrients?.length ?? 0) > 0 ||
                !!s.notes;
              return (
                <div
                  key={s.id}
                  className={`inline-flex items-stretch rounded-full border transition-colors overflow-hidden ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <button
                    onClick={() => toggleTaken.mutate(s.name)}
                    className="pl-3 pr-2 py-1.5 text-sm flex items-center gap-1.5"
                  >
                    {on && <Check className="size-3.5" />}
                    {s.name}
                  </button>
                  {hasInfo && (
                    <button
                      onClick={() => setInfoOpen(s)}
                      title="View nutrition info"
                      className={`pl-1.5 pr-2.5 flex items-center border-l ${
                        on ? "border-primary-foreground/30" : "border-border"
                      } opacity-70 hover:opacity-100`}
                    >
                      <Info className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
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
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">
                    {s.name}
                    {s.brand && <span className="text-muted-foreground font-normal"> · {s.brand}</span>}
                  </div>
                  {macroBits.length > 0 && (
                    <div className="text-xs text-muted-foreground truncate">{macroBits.join(" · ")}</div>
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
        onSaved={() => qc.invalidateQueries({ queryKey: ["supplements"] })}
      />

      <InfoDialog supplement={infoOpen} onClose={() => setInfoOpen(null)} />
    </div>
  );
}

function SupplementDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Supplement | null;
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

  // Reset fields when dialog opens
  const lastEditingId = useState<string | null>(null);
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
    setNutrients(editing?.nutrients ?? []);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        user_id: u.user!.id,
        name: name.trim(),
        brand: brand.trim() || null,
        serving_size: servingSize.trim() || null,
        calories: calories ? parseFloat(calories) : null,
        protein_g: protein ? parseFloat(protein) : null,
        carbs_g: carbs ? parseFloat(carbs) : null,
        fat_g: fat ? parseFloat(fat) : null,
        notes: notes.trim() || null,
        nutrients: nutrients.filter((n) => n.name.trim()),
      };
      if (editing) {
        const { error } = await supabase.from("user_supplements").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_supplements").insert(payload);
        if (error) throw error;
      }
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
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Magnesium glycinate" required />
            </div>
            <div>
              <Label className="text-xs">Brand</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="optional" />
            </div>
            <div>
              <Label className="text-xs">Serving size</Label>
              <Input value={servingSize} onChange={(e) => setServingSize(e.target.value)} placeholder="1 capsule" />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Per serving</Label>
            <div className="grid grid-cols-4 gap-2 mt-1.5">
              <FieldSmall label="kcal" value={calories} onChange={setCalories} />
              <FieldSmall label="Protein (g)" value={protein} onChange={setProtein} />
              <FieldSmall label="Carbs (g)" value={carbs} onChange={setCarbs} />
              <FieldSmall label="Fat (g)" value={fat} onChange={setFat} />
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
              {nutrients.map((n, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Input
                    value={n.name}
                    onChange={(e) => updateNutrient(i, { name: e.target.value })}
                    placeholder="Vitamin D"
                    className="flex-1"
                  />
                  <Input
                    value={n.amount}
                    onChange={(e) => updateNutrient(i, { amount: e.target.value })}
                    placeholder="1000"
                    className="w-20"
                  />
                  <Input
                    value={n.unit}
                    onChange={(e) => updateNutrient(i, { unit: e.target.value })}
                    placeholder="IU"
                    className="w-16"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeNutrient(i)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="When to take, with food, etc." />
          </div>

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

function FieldSmall({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
      />
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
