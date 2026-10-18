import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { disconnectWhoop, getWhoopStatus, startWhoopConnect, syncWhoop } from "@/lib/whoop.functions";
import type { WhoopResult } from "@/lib/whoop-return";

function notifyResult(result: WhoopResult) {
  if (result === "connected") toast.success("WHOOP connected.");
  else if (result === "denied") toast.message("WHOOP connection cancelled.");
  else toast.error("Couldn't connect WHOOP. Please try again.");
}

export function WhoopCard({ returnPage = "/settings" }: { returnPage?: "/settings" | "/onboarding" } = {}) {
  const qc = useQueryClient();
  const popupRef = useRef<Window | null>(null);
  const statusFn = useServerFn(getWhoopStatus);
  const startFn = useServerFn(startWhoopConnect);
  const syncFn = useServerFn(syncWhoop);
  const disconnectFn = useServerFn(disconnectWhoop);

  const status = useQuery({ queryKey: ["whoop-status"], queryFn: () => statusFn() });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("whoop");
    if (!p) return;
    notifyResult(p === "connected" || p === "denied" ? p : "error");
    void qc.invalidateQueries();
    window.history.replaceState({}, "", window.location.pathname);
  }, [qc]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !popupRef.current || event.source !== popupRef.current) return;
      const message = event.data;
      if (message?.type !== "cove:whoop-return" || !["connected", "denied", "error"].includes(message.status)) return;
      popupRef.current = null;
      notifyResult(message.status);
      void qc.invalidateQueries();
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [qc]);

  // WHOOP's sign-in page refuses to load inside a frame (e.g. the editor preview),
  // so when embedded we open it in a new tab. The tab is opened synchronously on
  // click so popup blockers allow it, then pointed at WHOOP once the URL is ready.
  const connect = useMutation({
    mutationFn: async () => {
      const embedded = window.self !== window.top;
      const popup = embedded ? window.open("about:blank", "_blank") : null;
      popupRef.current = popup;
      try {
        if (embedded && !popup) throw new Error("Allow pop-ups to connect WHOOP.");
        const { url } = await startFn({ data: { origin: window.location.origin, popup: embedded, page: returnPage } });
        if (popup) popup.location.href = url;
        else window.location.href = url;
        return embedded;
      } catch (e) {
        popup?.close();
        popupRef.current = null;
        throw e;
      }
    },
    onSuccess: (embedded) => {
      if (embedded) toast.message("WHOOP opened in a new tab. Finish signing in there.");
    },
    onError: (error: Error) => toast.error(error.message === "Allow pop-ups to connect WHOOP." ? error.message : "Couldn't start the WHOOP connection."),
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
            ? `Connected${last ? ` · last synced ${new Date(last).toLocaleString()}` : ""}. Recovery, HRV, resting heart rate, sleep and strain sync automatically every hour.`
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
