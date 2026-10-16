import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// iPhone app WHOOP controls. Body: { action: "status" | "connect" | "sync" | "disconnect" }
const Body = z.object({ action: z.enum(["status", "connect", "sync", "disconnect"]) });

export const Route = createFileRoute("/api/public/ios/whoop")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const w = await import("@/lib/whoop.server");
        const userId = await w.userIdFromBearer(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        const parsed = Body.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        try {
          switch (parsed.data.action) {
            case "status":
              return Response.json(await w.getWhoopStatusFor(userId));
            case "connect":
              return Response.json({
                url: await w.createAuthorizeUrl(userId, w.ALLOWED_REDIRECTS[0], "ios"),
              });
            case "sync": {
              const r = await w.syncWhoopForUser(userId);
              return Response.json({ days: r.days });
            }
            case "disconnect":
              await w.disconnectWhoopFor(userId);
              return Response.json({ ok: true });
          }
        } catch (e) {
          console.error("iOS WHOOP action failed", e);
          return new Response("WHOOP request failed", { status: 502 });
        }
      },
    },
  },
});
