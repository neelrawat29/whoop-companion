import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pin, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadPins, unpin } from "@/lib/pinned-insights";

/** Findings pinned from Insights. Hidden when nothing is pinned. */
export function PinnedInsightsCard() {
  const { data: pins } = useQuery({ queryKey: ["pinned-insights"], queryFn: () => loadPins(supabase) });
  const remove = useMutation({
    mutationFn: (id: string) => unpin(supabase, id),
    onSuccess: () => toast.success("Unpinned"),
    onError: () => toast.error("Couldn't unpin. Try again."),
  });

  if (!pins?.length) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2"><Pin className="size-4" /> Pinned</CardTitle>
          <CardDescription>Patterns you chose to keep in mind</CardDescription>
        </div>
        <Link to="/insights" className="text-sm text-primary font-medium shrink-0">All insights</Link>
      </CardHeader>
      <CardContent className="divide-y divide-border/60">
        {pins.map((p) => (
          <div key={p.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <p className="text-sm">{p.content}</p>
            <button
              type="button"
              onClick={() => remove.mutate(p.id)}
              disabled={remove.isPending}
              aria-label="Unpin"
              title="Unpin"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent disabled:opacity-50 shrink-0"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
