export const WHOOP_LIVE_ORIGIN = "https://cove-companion.lovable.app";

// Preview deployments rotate their subdomain (id-preview-<hash>--<project>.lovable.app),
// so match any preview host for this project instead of listing fixed URLs.
const PROJECT_PREVIEW = /^https:\/\/(?:id-preview(?:-[a-z0-9]+)?--|project--)603412a2-6b56-45ee-9ba4-200bab1c07f1(?:-dev)?\.lovable\.app$/;

export function isAllowedWebOrigin(origin: string): boolean {
  return origin === WHOOP_LIVE_ORIGIN || origin === "http://localhost:8080" || PROJECT_PREVIEW.test(origin);
}

export type WhoopResult = "connected" | "denied" | "error";

/** Pages a full-page WHOOP connection may return to. */
export const WHOOP_RETURN_PAGES = ["/settings", "/onboarding"] as const;
export type WhoopReturnPage = (typeof WHOOP_RETURN_PAGES)[number];

export function whoopWebReturn(origin: string, popup: boolean, page: WhoopReturnPage = "/settings"): string {
  if (!isAllowedWebOrigin(origin)) throw new Error("Unsupported Cove return address");
  if (!WHOOP_RETURN_PAGES.includes(page)) throw new Error("Unsupported Cove return page");
  return `${origin}${popup ? "/whoop-return" : page}`;
}

export function whoopCallbackLocation(returnTo: string, status: WhoopResult): string {
  if (returnTo === "ios") return `cove://whoop-callback?status=${status}`;
  let destination = `${WHOOP_LIVE_ORIGIN}/settings`;
  try {
    const url = new URL(returnTo);
    if (isAllowedWebOrigin(url.origin) && [...WHOOP_RETURN_PAGES, "/whoop-return"].includes(url.pathname)) {
      destination = `${url.origin}${url.pathname}`;
    }
  } catch { /* Legacy web states return to the live site. */ }
  return `${destination}?whoop=${status}`;
}
