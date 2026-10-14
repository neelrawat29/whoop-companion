import { describe, it, expect } from "vitest";
import { scoreBiologicalAge, HYDRATION_GOOD_ML, HYDRATION_LOW_ML } from "../biological-age";

const profile = { date_of_birth: "1990-01-01", sex: "male", height_cm: 180, weight_kg: 75, resting_hr_baseline: null } as any;
const entries = Array.from({ length: 14 }, (_, i) => ({
  entry_date: `2026-10-${String(i + 1).padStart(2, "0")}`, recovery: 60, hrv: 60, rhr: 55, sleep_hours: 7.5,
}));
function hydrationMod(mls: number[]) {
  const habits = mls.map((ml, i) => ({ entry_date: entries[i].entry_date, bedtime: null, drinks: 0, hydration: ml }));
  const r: any = scoreBiologicalAge({ profile, entries, habits, meals: [], now: new Date("2026-10-15") });
  return (r.modifiers ?? r.mods ?? []).find((m: any) => String(m.label).startsWith("Hydration"));
}

describe("biological age hydration (ml)", () => {
  it("thresholds are 2500 / 1250 ml", () => {
    expect(HYDRATION_GOOD_ML).toBe(2500);
    expect(HYDRATION_LOW_ML).toBe(1250);
  });
  it("exactly 2500 ml earns the bonus", () => expect(hydrationMod([2500, 2500])?.years).toBe(-0.5));
  it("2499 ml gets no bonus", () => expect(hydrationMod([2499])).toBeUndefined());
  it("1250 ml is neutral", () => expect(hydrationMod([1250])).toBeUndefined());
  it("1249 ml is penalised", () => expect(hydrationMod([1249])?.years).toBe(1));
  it("ignores unlogged 0 ml days", () => expect(hydrationMod([3000, 0, 0, 0])?.years).toBe(-0.5));
  it("labels in litres", () => expect(hydrationMod([3000])?.label).toBe("Hydration 3.0 L/day"));
});
