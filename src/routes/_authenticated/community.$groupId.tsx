import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Settings, Share2, Check, Crown, Flame, CalendarCheck, Heart } from "lucide-react";
import { toast } from "sonner";
import { getGroupLeaderboard } from "@/lib/community.functions";

export const Route = createFileRoute("/_authenticated/community/$groupId")({
  component: GroupPage,
});

type Metric = "streak" | "consistency" | "recovery";

function GroupPage() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const getLeaderboardFn = useServerFn(getGroupLeaderboard);
  const [metric, setMetric] = useState<Metric>("streak");
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["leaderboard", groupId],
    queryFn: () => getLeaderboardFn({ data: { groupId } }),
  });

  if (error) {
    return (
      <div className="space-y-4">
        <BackBar />
        <Card><CardContent className="p-6 text-sm text-destructive">{(error as Error).message}</CardContent></Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <BackBar />
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const { group, rows, me } = data;
  const sorted = [...rows].sort((a, b) => {
    if (metric === "streak") return (b.current_streak ?? 0) - (a.current_streak ?? 0);
    if (metric === "consistency") return (b.days_logged_7d ?? 0) - (a.days_logged_7d ?? 0);
    return (b.avg_recovery_7d ?? 0) - (a.avg_recovery_7d ?? 0);
  });

  async function shareInvite() {
    const url = `${window.location.origin}/community/join/${group.invite_code}`;
    const text = `Join “${group.name}” on Whoop Companion — code ${group.invite_code}\n${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: group.name, text, url });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Invite copied");
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {/* user cancelled */}
  }

  return (
    <div className="space-y-5">
      <BackBar />

      <div className="flex items-start gap-3">
        <div className="size-14 rounded-xl bg-accent flex items-center justify-center text-3xl shrink-0">
          {group.icon || "👥"}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{group.name}</h1>
          <div className="text-xs text-muted-foreground mt-0.5">
            {rows.length} member{rows.length === 1 ? "" : "s"} · code <span className="font-mono">{group.invite_code}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={shareInvite} className="gap-1.5">
          {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
          <span className="hidden sm:inline">Invite</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/community/$groupId/settings", params: { groupId } })}
        >
          <Settings className="size-4" />
        </Button>
      </div>

      <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="streak" className="gap-1.5"><Flame className="size-3.5" />Streak</TabsTrigger>
          <TabsTrigger value="consistency" className="gap-1.5"><CalendarCheck className="size-3.5" />7-day</TabsTrigger>
          <TabsTrigger value="recovery" className="gap-1.5"><Heart className="size-3.5" />Recovery</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {sorted.map((r, i) => {
          const isMe = r.user_id === me;
          const value =
            metric === "streak" ? `${r.current_streak ?? 0}d`
            : metric === "consistency" ? `${r.days_logged_7d ?? 0}/7`
            : r.avg_recovery_7d != null ? `${r.avg_recovery_7d}` : "—";
          return (
            <Card key={r.user_id} className={isMe ? "border-primary/50 bg-primary/5" : ""}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-6 text-center text-sm font-semibold text-muted-foreground">
                  {i + 1}
                </div>
                <div className="size-9 rounded-full bg-accent flex items-center justify-center text-sm font-medium shrink-0">
                  {(r.display_name || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate">{r.display_name}{isMe && " (you)"}</span>
                    {r.is_owner && <Crown className="size-3.5 text-primary shrink-0" />}
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-2 mt-0.5">
                    {r.logged_today ? (
                      <span className="text-primary inline-flex items-center gap-0.5"><Check className="size-3" />today</span>
                    ) : (
                      <span>not logged today</span>
                    )}
                    {r.avg_sleep_hours_7d != null && <span>· sleep {r.avg_sleep_hours_7d}h</span>}
                    {r.avg_energy_7d != null && <span>· energy {r.avg_energy_7d}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold tabular-nums">{value}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {metric === "streak" ? "streak" : metric === "consistency" ? "logged" : "recovery"}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function BackBar() {
  return (
    <Link to="/community" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Community
    </Link>
  );
}
