export type Recommendation = "push" | "moderate" | "rest";

export function recommend(recovery: number | null | undefined, push = 67, rest = 34): Recommendation | null {
  if (recovery == null) return null;
  if (recovery >= push) return "push";
  if (recovery < rest) return "rest";
  return "moderate";
}

export function recoveryColor(recovery: number | null | undefined, push = 67, rest = 34) {
  const r = recommend(recovery, push, rest);
  if (r === "push") return "text-[color:var(--recovery-high)]";
  if (r === "moderate") return "text-[color:var(--recovery-mid)]";
  if (r === "rest") return "text-[color:var(--recovery-low)]";
  return "text-muted-foreground";
}

/**
 * The app's day starts at 4am, not midnight: late-night logs belong to the
 * evening they're part of, and Today stays on that day until 4am.
 * Must match TodayDate.dayStartHour on iPhone.
 */
export const DAY_START_HOUR = 4;

/** The app's current day (YYYY-MM-DD, device-local): yesterday before 4am. */
export function today(now: Date = new Date()): string {
  const d = new Date(now);
  if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Calendar arithmetic on YYYY-MM-DD strings. */
export function shiftDay(iso: string, days: number): string {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
