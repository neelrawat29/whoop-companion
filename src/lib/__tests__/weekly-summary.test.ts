import { describe, it, expect } from "vitest";
import { buildWeeklySummary, shiftDate, type WeeklyEntry } from "../weekly-summary";
import type { HabitInsightRow } from "../habit-insights";

const TODAY = "2026-10-29"; // Thursday
const blank: Omit<HabitInsightRow, "entry_date"> = {
  drinks: 0, hydration: 0, last_caffeine_time: null, last_meal_time: null,
  work_location: null, strain: null, supplements: null, note: null,
};

function weeks(thisRec: number, lastRec: number, thisSleep = 7, lastSleep = 7): WeeklyEntry[] {
  const out: WeeklyEntry[] = [];
  for (let i = 0; i < 14; i++) {
    const d = shiftDate(TODAY, -i);
    const thisWeek = i < 7;
    out.push({ entry_date: d, recovery: thisWeek ? thisRec : lastRec, hrv: 60, rhr: 55, sleep_hours: thisWeek ? thisSleep : lastSleep });
  }
  return out;
}

describe("weekly summary", () => {
  it("covers the last 7 days including today", () => {
    const s = buildWeeklySummary({ today: TODAY, entries: [], habits: [], mealDays: [] });
    expect(s.start).toBe("2026-10-23");
    expect(s.end).toBe(TODAY);
  });

  it("compares with the week before and names the driver", () => {
    const s = buildWeeklySummary({ today: TODAY, entries: weeks(70, 60, 7.5, 6.5), habits: [], mealDays: [] });
    const rec = s.metrics.find((m) => m.key === "recovery")!;
    expect(rec.deltaText).toBe("+10 pts");
    expect(rec.better).toBe(true);
    expect(s.headline).toBe("Recovery averaged 70% this week, up 10 pts on the week before, with sleep up 60 min a night.");
  });

  it("says 'about the same' for small changes", () => {
    const s = buildWeeklySummary({ today: TODAY, entries: weeks(65, 64), habits: [], mealDays: [] });
    expect(s.headline).toBe("Recovery averaged 65% this week, about the same as the week before.");
  });

  it("finds best and worst days with the evening before", () => {
    const entries = weeks(60, 60);
    entries[0].recovery = 90; // today
    entries[2].recovery = 30; // 2 days ago
    const habits: HabitInsightRow[] = [
      { entry_date: shiftDate(TODAY, -3), ...blank, drinks: 3, last_caffeine_time: "16:30:00", strain: 15.2 },
      { entry_date: shiftDate(TODAY, -1), ...blank, last_meal_time: "18:30:00", strain: 6 },
    ];
    const s = buildWeeklySummary({ today: TODAY, entries, habits, mealDays: [] });
    expect(s.best!.recovery).toBe(90);
    expect(s.best!.dayLabel).toBe("Thu 29 Oct");
    expect(s.best!.notes).toContain("no drinks");
    expect(s.worst!.recovery).toBe(30);
    expect(s.worst!.notes).toEqual(["7h 0m sleep", "strain 15.2 the day before", "3 drinks", "caffeine at 4:30pm"]);
  });

  it("only averages meals on fully logged days and counts logging", () => {
    const mealDays = [
      { entry_date: TODAY, kcal: 2200, protein_g: 150 },
      { entry_date: shiftDate(TODAY, -1), kcal: 400, protein_g: 20 },
    ];
    const s = buildWeeklySummary({ today: TODAY, entries: [], habits: [], mealDays });
    const kcal = s.metrics.find((m) => m.key === "kcal")!;
    expect(kcal.thisText).toBe("2,200 kcal");
    expect(kcal.days).toBe(1);
    expect(s.logging.mealDays).toBe(2);
  });

  it("strain changes are neutral, not good or bad", () => {
    const habits: HabitInsightRow[] = [];
    for (let i = 0; i < 14; i++) habits.push({ entry_date: shiftDate(TODAY, -i), ...blank, strain: i < 7 ? 15 : 8 });
    const s = buildWeeklySummary({ today: TODAY, entries: [], habits, mealDays: [] });
    expect(s.metrics.find((m) => m.key === "strain")!.better).toBeNull();
  });
});
