import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState } from "react";
import { Pill, X, Check } from "lucide-react";
import { today, fmtDate } from "@/lib/recovery";

export const Route = createFileRoute("/_authenticated/supplements")({
  component: SupplementsPage,
});

function SupplementsPage() {
  const qc = useQueryClient();
  const date = today();

  const { data: supps } = useQuery({
    queryKey: ["supplements"],
    queryFn: async () => {
      const { data } = await supabase.from("user_supplements").select("*").order("name");
      return data ?? [];
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

  const [newSupp, setNewSupp] = useState("");
  const addSupp = useMutation({
    mutationFn: async () => {
      if (!newSupp.trim()) return;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("user_supplements")
        .insert({ user_id: u.user!.id, name: newSupp.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewSupp("");
      qc.invalidateQueries({ queryKey: ["supplements"] });
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
              return (
                <button
                  key={s.id}
                  onClick={() => toggleTaken.mutate(s.name)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors flex items-center gap-1.5 ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {on && <Check className="size-3.5" />}
                  {s.name}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manage your list</CardTitle>
          <CardDescription>These show up as chips here and on Today's evening check-in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addSupp.mutate();
            }}
            className="flex gap-2"
          >
            <Input
              value={newSupp}
              onChange={(e) => setNewSupp(e.target.value)}
              placeholder="e.g. magnesium, creatine, vitamin D"
            />
            <Button type="submit" disabled={addSupp.isPending}>
              Add
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {(supps ?? []).map((s) => (
              <button
                key={s.id}
                onClick={() => delSupp.mutate(s.id)}
                title="Remove"
                className="px-3 py-1 rounded-full text-sm border border-border hover:bg-destructive/10 flex items-center gap-1 text-muted-foreground"
              >
                {s.name} <X className="size-3" />
              </button>
            ))}
            {(supps ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">None yet.</p>
            )}
          </div>
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
    </div>
  );
}
