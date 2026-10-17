import { z } from "zod";

export const whoopWebhookSchema = z.object({
  user_id: z.number().int().positive().safe(),
  id: z.string().uuid(),
  type: z.enum(["sleep.updated", "sleep.deleted", "recovery.updated", "recovery.deleted", "workout.updated", "workout.deleted"]),
  trace_id: z.string().min(1).max(200),
});
export type WhoopWebhook = z.infer<typeof whoopWebhookSchema>;

export async function verifyWhoopSignature(raw: string, timestamp: string | null, signature: string | null, secret: string, now = Date.now()) {
  if (!timestamp || !/^\d{13}$/.test(timestamp) || !signature || Math.abs(now - Number(timestamp)) > 5 * 60_000) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + raw)));
  const expected = btoa(String.fromCharCode(...bytes));
  let diff = expected.length ^ signature.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (signature.charCodeAt(i) || 0);
  return diff === 0;
}

export const recoveryFields = ["recovery", "hrv", "rhr"] as const;
export const sleepFields = ["sleep_score", "sleep_hours"] as const;
/** Remove only values still owned by this import, never a subsequent manual edit. */
export function removedImportPatch(current: Record<string, unknown>, previous: Record<string, unknown>, fields: readonly string[]) {
  if (current.source !== "whoop") return {};
  const patch: Record<string, null> = {};
  for (const field of fields) {
    if (previous[field] != null && current[field] != null && Number(current[field]) === Number(previous[field])) patch[field] = null;
  }
  return patch;
}