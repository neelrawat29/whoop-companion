import { describe, it, expect } from "vitest";
import { analyzeHabits, compareGroups, hasEveningLog, lateMinutes, nextDate, type HabitInsightRow, type OutcomeRow } from "../habit-insights";

const blank: Omit<HabitInsightRow, "entry_date"> = {
  drinks: 0, hydration: 0, last_caffeine_time: null, last_meal_time: null,
  work_location: null, strain: null, supplements: null, note: null,
};

function day(i: number) {
  const d = new Date(Date.UTC(2026, 0, 1 + i));
  return d.toISOString().slice(0, 10);
}

describe("habit insights", () => {
  it("nextDate crosses month and year boundaries", () => {
    expect(nextDate("2026-01-31")).toBe("2026-02-01");
    expect(nextDate("2025-12-31")).toBe("2026-01-01");
  });

  it("treats times after midnight as late night", () => {
    expect(lateMinutes("14:30:00")).toBe(870);
    expect(lateMinutes("00:30")).toBe(24 * 60 + 30);
    expect(lateMinutes(null)).toBeNull();
  });

  it("a WHOOP-only strain row is not an evening check-in", () => {
    expect(hasEveningLog({ entry_date: day(0), ...blank, strain: 12 })).toBe(false);
    expect(hasEveningLog({ entry_date: day(0), ...blank, last_meal_time: "19:00" })).toBe(true);
  });

  it("compares a habit with the NEXT morning's recovery", () => {
    const habits: HabitInsightRow[] = [];
    const outcomes: OutcomeRow[] = [];
    for (let i = 0; i < 24; i++) {
      const drank = i % 2 === 0;
      habits.push({ entry_date: day(i), ...blank, drinks: drank ? 2 : 0, last_meal_time: "19:00" });
      // Same-day recovery is the opposite of the next-day effect, so a
      // same-day comparison would point the wrong way.
      outcomes.push({ entry_date: day(i), recovery: drank ? 80 : 50, hrv: null, rhr: null, sleep_hours: null });
    }
    // Overwrite with the real next-morning pattern: drinking night → low recovery.
    for (let i = 0; i < 24; i++) {
      const drankNightBefore = (i - 1) % 2 === 0;
      outcomes[i].recovery = drankNightBefore ? 45 + (i % 3) : 70 + (i % 3);
    }
    const r = analyzeHabits({ habits, outcomes });
    const alcohol = r.findings.find((f) => f.id === "alcohol")!;
    expect(alcohol).toBeTruthy();
    expect(alcohol.primary.delta).toBeLessThan(-20);
    expect(alcohol.primary.better).toBe(false);
    expect(alcohol.primary.confidence).toBe("consistent");
    expect(alcohol.sentence).toMatch(/After evenings with 1\+ drinks, your recovery averaged \d+% vs \d+%/);
  });

  it("ignores days without an evening check-in for drinks", () => {
    const habits: HabitInsightRow[] = [];
    const outcomes: OutcomeRow[] = [];
    for (let i = 0; i < 12; i++) {
      // Strain-only rows (drinks defaults to 0) must not count as "no drinks".
      habits.push({ entry_date: day(i), ...blank, strain: 10 });
      outcomes.push({ entry_date: day(i + 1), recovery: 60, hrv: null, rhr: null, sleep_hours: null });
    }
    const r = analyzeHabits({ habits, outcomes });
    expect(r.findings.find((f) => f.id === "alcohol")).toBeUndefined();
    expect(r.noClearLink).not.toContain("1+ drinks");
  });

  it("needs at least 3 nights on each side", () => {
    expect(compareGroups("recovery", [50, 50], [70, 70, 70])).toBeNull();
    expect(compareGroups("recovery", [50, 52, 51], [70, 71, 69])).not.toBeNull();
  });

  it("labels small samples as early even with a big gap", () => {
    const e = compareGroups("recovery", [40, 42, 44], [70, 72, 74])!;
    expect(e.confidence).toBe("early");
    expect(e.notable).toBe(true);
  });

  it("compares other habits on drink-free nights only", () => {
    const habits: HabitInsightRow[] = [];
    const outcomes: OutcomeRow[] = [];
    for (let i = 0; i < 24; i++) {
      // Office days always coincide with drinking; recovery only drops because of the drinks.
      const office = i % 2 === 0;
      habits.push({ entry_date: day(i), ...blank, work_location: office ? "office" : "home", drinks: office ? 3 : 0 });
      outcomes.push({ entry_date: day(i + 1), recovery: office ? 40 : 70, hrv: null, rhr: null, sleep_hours: null });
    }
    const r = analyzeHabits({ habits, outcomes });
    expect(r.findings.find((f) => f.id === "work-home")).toBeUndefined();
  });

  it("lower resting heart rate counts as better", () => {
    const e = compareGroups("rhr", [52, 53, 52, 51, 52], [56, 57, 56, 55, 56])!;
    expect(e.better).toBe(true);
  });

  it("puts habits with no difference under no clear link", () => {
    const habits: HabitInsightRow[] = [];
    const outcomes: OutcomeRow[] = [];
    for (let i = 0; i < 16; i++) {
      habits.push({ entry_date: day(i), ...blank, work_location: i % 2 ? "home" : "office" });
      outcomes.push({ entry_date: day(i + 1), recovery: 60 + (i % 3), hrv: null, rhr: null, sleep_hours: null });
    }
    const r = analyzeHabits({ habits, outcomes });
    expect(r.noClearLink).toContain("Worked from home");
  });

  it("uses meal totals only on fully logged days", () => {
    const habits: HabitInsightRow[] = [];
    const outcomes: OutcomeRow[] = [];
    const mealDays = [];
    for (let i = 0; i < 16; i++) {
      habits.push({ entry_date: day(i), ...blank });
      const hit = i % 2 === 0;
      mealDays.push({ entry_date: day(i), kcal: i < 2 ? 400 : 2000, protein_g: hit ? 150 : 80 });
      outcomes.push({ entry_date: day(i + 1), recovery: hit ? 75 : 55, hrv: null, rhr: null, sleep_hours: null });
    }
    const r = analyzeHabits({ habits, outcomes, mealDays, targets: { kcal_target: 2200, protein_target: 140 } });
    const p = r.findings.find((f) => f.id === "protein")!;
    expect(p.primary.nWith + p.primary.nWithout).toBe(14);
    expect(p.primary.delta).toBeCloseTo(20);
  });
});
