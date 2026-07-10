// Pure helpers used by both web server functions and iOS API routes.

export const TIME_OF_DAY = ["morning", "afternoon", "evening", "night", "anytime"] as const;
export type TimeOfDay = (typeof TIME_OF_DAY)[number];

export interface SupplementLite {
  id: string;
  name: string;
  time_of_day: string | null;
}

export interface HabitsRowLite {
  entry_date: string;
  supplements: string[] | null;
}

export interface SupplementStat {
  id: string;
  name: string;
  time_of_day: string | null;
  taken_days_30: number;
  logged_days_30: number;
  adherence_pct_30: number; // 0-100
  taken_last_7: number;
  streak_days: number; // consecutive days ending today
}

/** Compute adherence over the trailing 30 days (relative to `today`). */
export function computeSupplementStats(
  supps: SupplementLite[],
  history: HabitsRowLite[],
  today: string, // "YYYY-MM-DD"
): SupplementStat[] {
  const cutoff30 = shiftDate(today, -29);
  const cutoff7 = shiftDate(today, -6);

  const rows30 = history.filter((h) => h.entry_date >= cutoff30 && h.entry_date <= today);
  const loggedDays30 = rows30.length;
  const rows7 = rows30.filter((h) => h.entry_date >= cutoff7);

  return supps.map((s) => {
    const taken30 = rows30.filter((h) => (h.supplements ?? []).includes(s.name)).length;
    const taken7 = rows7.filter((h) => (h.supplements ?? []).includes(s.name)).length;
    const adherence = loggedDays30 > 0 ? Math.round((taken30 / loggedDays30) * 100) : 0;

    // streak: walk back from today until first day this supp wasn't taken
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const d = shiftDate(today, -i);
      const row = history.find((h) => h.entry_date === d);
      if (!row) break;
      if ((row.supplements ?? []).includes(s.name)) streak++;
      else break;
    }

    return {
      id: s.id,
      name: s.name,
      time_of_day: s.time_of_day,
      taken_days_30: taken30,
      logged_days_30: loggedDays30,
      adherence_pct_30: adherence,
      taken_last_7: taken7,
      streak_days: streak,
    };
  });
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Group supplements by time_of_day, preserving TIME_OF_DAY order. Nulls last as "anytime". */
export function groupByTimeOfDay<T extends { time_of_day: string | null }>(
  items: T[],
): Array<{ key: TimeOfDay; items: T[] }> {
  const buckets = new Map<TimeOfDay, T[]>();
  for (const t of TIME_OF_DAY) buckets.set(t, []);
  for (const it of items) {
    const key = (TIME_OF_DAY as readonly string[]).includes(it.time_of_day ?? "")
      ? (it.time_of_day as TimeOfDay)
      : "anytime";
    buckets.get(key)!.push(it);
  }
  return Array.from(buckets.entries())
    .filter(([, v]) => v.length > 0)
    .map(([key, items]) => ({ key, items }));
}
