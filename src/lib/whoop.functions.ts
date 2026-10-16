import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startWhoopConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ origin: z.string().url().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { ALLOWED_REDIRECTS, createAuthorizeUrl } = await import("./whoop.server");
    const redirect = `${data.origin.replace(/\/$/, "")}/api/public/whoop/callback`;
    const redirectUri = ALLOWED_REDIRECTS.includes(redirect) ? redirect : ALLOWED_REDIRECTS[0];
    return { url: await createAuthorizeUrl(context.userId, redirectUri, "web") };
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
