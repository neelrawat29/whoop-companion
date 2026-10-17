export const WHOOP_LIVE_ORIGIN = "https://cove-companion.lovable.app";
const WEB_ORIGINS = [
  WHOOP_LIVE_ORIGIN,
  "https://id-preview--603412a2-6b56-45ee-9ba4-200bab1c07f1.lovable.app",
  "https://project--603412a2-6b56-45ee-9ba4-200bab1c07f1.lovable.app",
  "https://project--603412a2-6b56-45ee-9ba4-200bab1c07f1-dev.lovable.app",
  "http://localhost:8080",
];

export type WhoopResult = "connected" | "denied" | "error";

export function whoopWebReturn(origin: string, popup: boolean): string {
  if (!WEB_ORIGINS.includes(origin)) throw new Error("Unsupported Cove return address");
  return `${origin}${popup ? "/whoop-return" : "/settings"}`;
}

export function whoopCallbackLocation(returnTo: string, status: WhoopResult): string {
  if (returnTo === "ios") return `cove://whoop-callback?status=${status}`;
  let destination = `${WHOOP_LIVE_ORIGIN}/settings`;
  try {
    const url = new URL(returnTo);
    if (WEB_ORIGINS.includes(url.origin) && ["/settings", "/whoop-return"].includes(url.pathname)) {
      destination = `${url.origin}${url.pathname}`;
    }
  } catch { /* Legacy web states return to the live site. */ }
  return `${destination}?whoop=${status}`;
}