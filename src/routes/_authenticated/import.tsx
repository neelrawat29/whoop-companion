import { covePageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => covePageHead("Import WHOOP Data", "Import your recovery and sleep data into Cove."),
  component: ImportPage,
});

function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Import</h1>
        <p className="text-muted-foreground text-sm">Bring in past WHOOP history from a CSV export. New days sync automatically once WHOOP is connected in Settings.</p>
      </div>

      <CsvImport />
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
