import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { extractFromScreenshot } from "@/lib/whoop-extract.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/import")({
  component: ImportPage,
});

function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import</h1>
        <p className="text-muted-foreground text-sm">Three ways to get your Whoop data in.</p>
      </div>

      <Tabs defaultValue="csv">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="csv">CSV upload</TabsTrigger>
          <TabsTrigger value="screenshot">Screenshot AI</TabsTrigger>
        </TabsList>
        <TabsContent value="csv"><CsvImport /></TabsContent>
        <TabsContent value="screenshot"><ScreenshotImport /></TabsContent>
      </Tabs>
    </div>
  );
}

function CsvImport() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user!.id;
      const upserts = rows.map((r) => ({ user_id: userId, ...r, source: "csv" }));
      if (upserts.length === 0) throw new Error("No valid rows found");
      const { error } = await supabase.from("daily_entries").upsert(upserts, { onConflict: "user_id,entry_date" });
      if (error) throw error;
      toast.success(`Imported ${upserts.length} days`);
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Whoop CSV export</CardTitle>
        <CardDescription>
          In the Whoop app: Profile → App Settings → Data Export. Upload <code>physiological_cycles.csv</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Input type="file" accept=".csv" onChange={handleFile} disabled={busy} />
        {busy && <p className="text-sm text-muted-foreground mt-2">Importing...</p>}
      </CardContent>
    </Card>
  );
}

function parseCsv(text: string): Array<{ entry_date: string; recovery: number | null; hrv: number | null; rhr: number | null; sleep_score: number | null; sleep_hours: number | null }> {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const idx = (names: string[]) => names.map((n) => header.findIndex((h) => h.includes(n))).find((i) => i >= 0) ?? -1;

  const iDate = idx(["cycle start time", "date"]);
  const iRec = idx(["recovery score"]);
  const iHrv = idx(["heart rate variability", "hrv"]);
  const iRhr = idx(["resting heart rate", "rhr"]);
  const iSleepScore = idx(["sleep performance"]);
  const iSleepHrs = idx(["asleep duration", "sleep duration"]);

  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const dateRaw = cols[iDate];
    if (!dateRaw) continue;
    const date = new Date(dateRaw);
    if (isNaN(date.getTime())) continue;
    const iso = date.toISOString().slice(0, 10);
    rows.push({
      entry_date: iso,
      recovery: num(cols[iRec]),
      hrv: num(cols[iHrv]),
      rhr: num(cols[iRhr]),
      sleep_score: num(cols[iSleepScore]),
      sleep_hours: num(cols[iSleepHrs]),
    });
  }
  // dedupe by date (keep first)
  const seen = new Set<string>();
  return rows.filter((r) => seen.has(r.entry_date) ? false : (seen.add(r.entry_date), true));
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === "," && !inQ) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

function num(v: string | undefined): number | null {
  if (!v || v.trim() === "") return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function ScreenshotImport() {
  const extract = useServerFn(extractFromScreenshot);
  const qc = useQueryClient();
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const run = useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const mime = file.type || "image/png";
      return extract({ data: { imageBase64: `data:${mime};base64,${b64}` } });
    },
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error(e.message),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setResult(null);
    run.mutate(file);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!result) return;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("daily_entries").upsert({
        user_id: u.user!.id,
        entry_date: date,
        recovery: result.recovery ?? null,
        hrv: result.hrv ?? null,
        rhr: result.rhr ?? null,
        sleep_score: result.sleep_score ?? null,
        sleep_hours: result.sleep_hours ?? null,
        source: "screenshot",
      }, { onConflict: "user_id,entry_date" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved from screenshot"); qc.invalidateQueries(); setResult(null); setPreview(null); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Screenshot the Whoop app</CardTitle>
        <CardDescription>AI extracts your Recovery, HRV, RHR, and Sleep. Review before saving.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input type="file" accept="image/*" onChange={onFile} disabled={run.isPending} />
        {preview && <img src={preview} alt="Preview" className="max-h-64 rounded-md border border-border" />}
        {run.isPending && <p className="text-sm text-muted-foreground">Extracting...</p>}
        {result && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <div>
                <DatePicker value={date} onChange={setDate} disableFuture />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Field label="Recovery" value={result.recovery} onChange={(v) => setResult({ ...result, recovery: v })} />
              <Field label="HRV" value={result.hrv} onChange={(v) => setResult({ ...result, hrv: v })} />
              <Field label="RHR" value={result.rhr} onChange={(v) => setResult({ ...result, rhr: v })} />
              <Field label="Sleep score" value={result.sleep_score} onChange={(v) => setResult({ ...result, sleep_score: v })} />
              <Field label="Sleep hrs" value={result.sleep_hours} onChange={(v) => setResult({ ...result, sleep_hours: v })} />
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: any; onChange: (v: any) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="0.1" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))} />
    </div>
  );
}
