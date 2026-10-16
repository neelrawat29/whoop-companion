import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { disconnectWhoop, getWhoopStatus, startWhoopConnect, syncWhoop } from "@/lib/whoop.functions";

export function WhoopCard() {
  const statusFn = useServerFn(getWhoopStatus);
  const startFn = useServerFn(startWhoopConnect);
  const syncFn = useServerFn(syncWhoop);
  const disconnectFn = useServerFn(disconnectWhoop);

  const status = useQuery({ queryKey: ["whoop-status"], queryFn: () => statusFn() });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("whoop");
    if (!p) return;
    if (p === "connected") toast.success("WHOOP connected — your recent days were imported.");
    else if (p === "denied") toast.message("WHOOP connection cancelled.");
    else toast.error("Couldn't connect WHOOP. Please try again.");
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const connect = useMutation({
    mutationFn: () => startFn({ data: { origin: window.location.origin } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: () => toast.error("Couldn't start the WHOOP connection."),
  });
  const sync = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (r) => toast.success(`Synced ${r.days} day${r.days === 1 ? "" : "s"} from WHOOP.`),
    onError: () => toast.error("WHOOP sync failed. Try reconnecting."),
  });
  const disconnect = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: () => toast.success("WHOOP disconnected."),
  });

  const connected = status.data?.connected;
  const last = status.data?.lastSyncedAt;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="size-4 text-primary" /> WHOOP
        </CardTitle>
        <CardDescription>
          {connected
            ? `Connected${last ? ` · last synced ${new Date(last).toLocaleString()}` : ""}. Recovery, HRV, resting heart rate, sleep and strain fill in automatically.`
            : "Connect your WHOOP account to fill in recovery, HRV, resting heart rate, sleep and strain automatically."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {status.isLoading ? null : connected ? (
          <>
            <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
              {sync.isPending ? "Syncing…" : "Sync now"}
            </Button>
            <Button variant="outline" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
            {connect.isPending ? "Opening WHOOP…" : "Connect WHOOP"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
