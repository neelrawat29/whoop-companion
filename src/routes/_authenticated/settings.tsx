import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
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

  if (profile && push === "" && rest === "") {
    setPush(profile.threshold_push?.toString() ?? "67");
    setRest(profile.threshold_rest?.toString() ?? "34");
    setName(profile.display_name ?? "");
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

  const { data: supps } = useQuery({
    queryKey: ["supplements"],
    queryFn: async () => {
      const { data } = await supabase.from("user_supplements").select("*").order("name");
      return data ?? [];
    },
  });

  const [newSupp, setNewSupp] = useState("");
  const addSupp = useMutation({
    mutationFn: async () => {
      if (!newSupp.trim()) return;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("user_supplements").insert({ user_id: u.user!.id, name: newSupp.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setNewSupp(""); qc.invalidateQueries({ queryKey: ["supplements"] }); },
    onError: (e) => toast.error(e.message),
  });

  const delSupp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_supplements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplements"] }),
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
          <CardTitle className="text-base">Supplements</CardTitle>
          <CardDescription>Your chip picker on the evening check-in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); addSupp.mutate(); }} className="flex gap-2">
            <Input value={newSupp} onChange={(e) => setNewSupp(e.target.value)} placeholder="e.g. magnesium" />
            <Button type="submit">Add</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {(supps ?? []).map((s) => (
              <button
                key={s.id}
                onClick={() => delSupp.mutate(s.id)}
                className="px-3 py-1 rounded-full text-sm border border-border hover:bg-destructive/10 flex items-center gap-1"
              >
                {s.name} <X className="size-3" />
              </button>
            ))}
            {(supps ?? []).length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
          </div>
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
