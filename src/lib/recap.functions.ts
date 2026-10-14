import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildRecapDefaults, parseLocalDate, saveRecapPayload, validateRecapPayload, type RecapDefaults, type RecapSaveResult } from "./recap.shared";

export const getRecapDefaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ({ date: parseLocalDate((data as any)?.date) }))
  .handler(async ({ data, context }): Promise<RecapDefaults> => {
    return buildRecapDefaults(context.supabase, context.userId, data.date);
  });

export const saveRecap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => validateRecapPayload(data))
  .handler(async ({ data, context }): Promise<RecapSaveResult> => {
    return saveRecapPayload(context.supabase, context.userId, data, data.date);
  });
