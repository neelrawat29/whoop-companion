import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/whoop-return")({
  head: () => ({ meta: [
    { title: "WHOOP Connection | Cove" },
    { name: "description", content: "Return to Cove after connecting your WHOOP account." },
    { property: "og:title", content: "WHOOP Connection | Cove" },
    { property: "og:description", content: "Return to Cove after connecting your WHOOP account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: WhoopReturn,
});

function WhoopReturn() {
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("whoop");
    const status = result === "connected" || result === "denied" ? result : "error";
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: "cove:whoop-return", status }, window.location.origin);
      window.close();
    } else {
      window.location.replace(`/settings?whoop=${status}`);
    }
  }, []);
  return <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
    <h1 className="text-2xl font-semibold">Returning to Cove</h1>
    <Button variant="outline" asChild><Link to="/settings">Back to Settings</Link></Button>
  </main>;
}