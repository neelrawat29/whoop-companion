import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Users, Plus, LogIn, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { createGroup, getMyGroups, joinGroupByCode } from "@/lib/community.functions";

export const Route = createFileRoute("/_authenticated/community/")({
  component: CommunityHome,
});

function CommunityHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getMyGroupsFn = useServerFn(getMyGroups);
  const createGroupFn = useServerFn(createGroup);
  const joinGroupFn = useServerFn(joinGroupByCode);

  const { data: groups, isLoading } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => getMyGroupsFn(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("👥");
  const [code, setCode] = useState("");

  const createMut = useMutation({
    mutationFn: (vars: { name: string; icon: string }) => createGroupFn({ data: vars }),
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ["my-groups"] });
      setCreateOpen(false);
      setName("");
      toast.success(`Created “${g.name}”`);
      navigate({ to: "/community/$groupId", params: { groupId: g.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const joinMut = useMutation({
    mutationFn: (vars: { code: string }) => joinGroupFn({ data: vars }),
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ["my-groups"] });
      setJoinOpen(false);
      setCode("");
      toast.success(`Joined “${g.name}”`);
      navigate({ to: "/community/$groupId", params: { groupId: g.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Users className="size-6 text-primary" /> Community
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Stay accountable with friends. Compare streaks and recovery — your meals and notes stay private.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="size-4" /> Create group</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New group</DialogTitle>
              <DialogDescription>Give it a name. You can invite friends with a 6-character code.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value.slice(0, 4))}
                  className="w-16 text-center text-xl"
                  aria-label="Icon"
                />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Morning Crew"
                  maxLength={60}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMut.mutate({ name: name.trim(), icon: icon.trim() || "👥" })}
                disabled={!name.trim() || createMut.isPending}
              >
                {createMut.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2"><LogIn className="size-4" /> Join with code</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Join a group</DialogTitle>
              <DialogDescription>Paste the 6-character invite code your friend shared.</DialogDescription>
            </DialogHeader>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="ABC123"
              className="text-center text-xl tracking-[0.4em] font-mono"
              maxLength={6}
              autoFocus
            />
            <DialogFooter>
              <Button
                onClick={() => joinMut.mutate({ code })}
                disabled={code.length !== 6 || joinMut.isPending}
              >
                {joinMut.isPending ? "Joining…" : "Join"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading your groups…</div>
      ) : !groups?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No groups yet</CardTitle>
            <CardDescription>
              Create one and share the code with friends — or join one they already made.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {groups.map((g) => (
            <Link
              key={g.id}
              to="/community/$groupId"
              params={{ groupId: g.id }}
              className="group"
            >
              <Card className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="size-12 rounded-lg bg-accent flex items-center justify-center text-2xl shrink-0">
                    {g.icon || "👥"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{g.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{g.invite_code}</div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
