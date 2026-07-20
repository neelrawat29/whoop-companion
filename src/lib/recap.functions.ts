import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildRecapDefaults, saveRecapPayload, validateRecapPayload, type RecapDefaults, type RecapSaveResult } from "./recap.shared";

export const getRecapDefaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecapDefaults> => {
    return buildRecapDefaults(context.supabase, context.userId);
  });

export const saveRecap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => validateRecapPayload(data))
  .handler(async ({ data, context }): Promise<RecapSaveResult> => {
    return saveRecapPayload(context.supabase, context.userId, data);
  });
