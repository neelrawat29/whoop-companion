import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, recoveryColor } from "@/lib/recovery";

export const Route = createFileRoute("/_authenticated/log")({
  component: LogPage,
});

function LogPage() {
  const { data: entries } = useQuery({
    queryKey: ["log-entries"],
    queryFn: async () => {
      const { data } = await supabase.from("daily_entries").select("*").order("entry_date", { ascending: false }).limit(90);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Log</h1>
        <p className="text-muted-foreground text-sm">Your last 90 days.</p>
      </div>

      {entries && entries.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No entries yet. <Link to="/" className="underline text-foreground">Log today</Link>.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {entries?.map((e) => (
          <Card key={e.id}>
            <CardContent className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{fmtDate(e.entry_date)}</div>
                <div className="text-xs text-muted-foreground">
                  HRV {e.hrv ?? "—"} · RHR {e.rhr ?? "—"} · Sleep {e.sleep_hours ?? "—"}h
                </div>
              </div>
              <div className={`text-2xl font-semibold ${recoveryColor(e.recovery)}`}>
                {e.recovery ?? "—"}{e.recovery != null && "%"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
