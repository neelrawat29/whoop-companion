import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { joinGroupByCode, previewGroupByCode } from "@/lib/community.functions";

export const Route = createFileRoute("/_authenticated/community/join/$code")({
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const previewFn = useServerFn(previewGroupByCode);
  const joinFn = useServerFn(joinGroupByCode);

  const codeUpper = code.toUpperCase();

  const { data, isLoading, error } = useQuery({
    queryKey: ["group-preview", codeUpper],
    queryFn: () => previewFn({ data: { code: codeUpper } }),
    retry: false,
  });

  const joinMut = useMutation({
    mutationFn: () => joinFn({ data: { code: codeUpper } }),
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ["my-groups"] });
      toast.success(`Joined “${g.name}”`);
      navigate({ to: "/community/$groupId", params: { groupId: g.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Looking up invite…</div>;

  if (error || !data) {
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Invite not found</CardTitle>
          <CardDescription>The code <span className="font-mono">{codeUpper}</span> doesn’t match any group.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/community"><Button variant="outline">Back to Community</Button></Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">{data.icon || "👥"}</span> {data.name}
        </CardTitle>
        <CardDescription>
          {data.member_count} member{data.member_count === 1 ? "" : "s"} · invite code <span className="font-mono">{data.invite_code}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        {data.already_member ? (
          <Button onClick={() => navigate({ to: "/community/$groupId", params: { groupId: data.id } })}>
            Open group
          </Button>
        ) : (
          <Button onClick={() => joinMut.mutate()} disabled={joinMut.isPending}>
            {joinMut.isPending ? "Joining…" : "Join group"}
          </Button>
        )}
        <Link to="/community"><Button variant="outline">Cancel</Button></Link>
      </CardContent>
    </Card>
  );
}
