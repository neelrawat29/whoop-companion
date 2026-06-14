import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw, Trash2, LogOut, UserMinus } from "lucide-react";
import { toast } from "sonner";
import {
  deleteGroup, getGroupLeaderboard, leaveGroup,
  regenerateInviteCode, removeMember, renameGroup,
} from "@/lib/community.functions";

export const Route = createFileRoute("/_authenticated/community/$groupId/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getLeaderboardFn = useServerFn(getGroupLeaderboard);
  const renameFn = useServerFn(renameGroup);
  const regenFn = useServerFn(regenerateInviteCode);
  const removeFn = useServerFn(removeMember);
  const leaveFn = useServerFn(leaveGroup);
  const deleteFn = useServerFn(deleteGroup);

  const { data } = useQuery({
    queryKey: ["leaderboard", groupId],
    queryFn: () => getLeaderboardFn({ data: { groupId } }),
  });

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["leaderboard", groupId] });
    qc.invalidateQueries({ queryKey: ["my-groups"] });
  }

  const renameMut = useMutation({
    mutationFn: (vars: { name: string; icon: string }) =>
      renameFn({ data: { groupId, name: vars.name, icon: vars.icon } }),
    onSuccess: () => { toast.success("Saved"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const regenMut = useMutation({
    mutationFn: () => regenFn({ data: { groupId } }),
    onSuccess: () => { toast.success("New invite code generated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => removeFn({ data: { groupId, userId } }),
    onSuccess: () => { toast.success("Member removed"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const leaveMut = useMutation({
    mutationFn: () => leaveFn({ data: { groupId } }),
    onSuccess: () => { toast.success("Left group"); invalidate(); navigate({ to: "/community" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteFn({ data: { groupId } }),
    onSuccess: () => { toast.success("Group deleted"); invalidate(); navigate({ to: "/community" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const { group, rows, me } = data;
  const isOwner = group.created_by === me;
  const currentName = name || group.name;
  const currentIcon = icon || group.icon || "👥";

  return (
    <div className="space-y-5 max-w-xl">
      <Link to="/community/$groupId" params={{ groupId }} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {group.name}
      </Link>

      <h1 className="text-xl font-semibold">Group settings</h1>

      {isOwner && (
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={currentIcon}
                onChange={(e) => setIcon(e.target.value.slice(0, 4))}
                className="w-16 text-center text-xl"
              />
              <Input
                value={currentName}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
              />
            </div>
            <Button onClick={() => renameMut.mutate()} disabled={renameMut.isPending}>
              {renameMut.isPending ? "Saving…" : "Save"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Invite code</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <div className="font-mono text-2xl tracking-[0.3em]">{group.invite_code}</div>
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => regenMut.mutate()} disabled={regenMut.isPending} className="gap-1.5">
              <RefreshCw className="size-4" /> Regenerate
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Members</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 py-1">
              <div className="size-8 rounded-full bg-accent flex items-center justify-center text-sm font-medium">
                {(m.display_name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 text-sm">
                {m.display_name}{m.user_id === me && " (you)"} {m.is_owner && <span className="text-xs text-muted-foreground">· owner</span>}
              </div>
              {isOwner && m.user_id !== me && (
                <Button variant="ghost" size="sm" onClick={() => removeMut.mutate(m.user_id)} className="text-destructive">
                  <UserMinus className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Danger zone</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!isOwner && (
            <Button variant="outline" onClick={() => { if (confirm("Leave this group?")) leaveMut.mutate(); }} className="gap-2">
              <LogOut className="size-4" /> Leave group
            </Button>
          )}
          {isOwner && (
            <Button
              variant="destructive"
              onClick={() => { if (confirm("Delete this group for everyone? This cannot be undone.")) deleteMut.mutate(); }}
              className="gap-2"
            >
              <Trash2 className="size-4" /> Delete group
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
