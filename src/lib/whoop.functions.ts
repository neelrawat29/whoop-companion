import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { whoopWebReturn } from "./whoop-return";

export const startWhoopConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ origin: z.string().url().max(200), popup: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    const { ALLOWED_REDIRECTS, createAuthorizeUrl } = await import("./whoop.server");
    // Always use the live-site redirect: it's the one registered in the WHOOP dashboard.
    // WHOOP rejects any redirect_uri that isn't an exact match.
    const returnTo = whoopWebReturn(data.origin, data.popup);
    return { url: await createAuthorizeUrl(context.userId, ALLOWED_REDIRECTS[0], returnTo) };
  });

export const getWhoopStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getWhoopStatusFor } = await import("./whoop.server");
    return getWhoopStatusFor(context.userId);
  });

export const syncWhoop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncWhoopForUser } = await import("./whoop.server");
    return syncWhoopForUser(context.userId);
  });

export const disconnectWhoop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { disconnectWhoopFor } = await import("./whoop.server");
    await disconnectWhoopFor(context.userId);
    return { ok: true };
  });
