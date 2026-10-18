import { describe, it, expect } from "vitest";
import { computeTargets, measuredTdee } from "../targets.shared";

const base = { sex: "male" as const, height_cm: 180, weight_kg: 80, birth_year: new Date().getFullYear() - 30, activity_level: "moderate" as const };

describe("personalised eaten vs burned targets", () => {
  it("lose standard: deficit = 0.5% body weight/week (80 kg → 440 kcal/day)", () => {
    const t = computeTargets({ ...base, goal: "lose", goal_pace: "standard", measured_tdee: 2800 })!;
    expect(t.burn_kcal - t.kcal).toBe(440);
  });
  it("lose deficit is capped at 22% of maintenance for small bodies (standard)", () => {
    const t = computeTargets({ ...base, weight_kg: 80, goal: "lose", goal_pace: "standard", measured_tdee: 1800 })!;
    expect(t.burn_kcal - t.kcal).toBe(396);
  });
  it("gain standard: +10% of maintenance", () => {
    const t = computeTargets({ ...base, goal: "gain", goal_pace: "standard", measured_tdee: 3000 })!;
    expect(t.kcal - t.burn_kcal).toBe(300);
  });
  it("gain gentle: +5% of maintenance", () => {
    const t = computeTargets({ ...base, goal: "gain", goal_pace: "gentle", measured_tdee: 3000 })!;
    expect(t.kcal - t.burn_kcal).toBe(150);
  });
  it("measured wearable burn replaces the formula estimate", () => {
    const t = computeTargets({ ...base, goal: "maintain", measured_tdee: 2650 })!;
    expect(t.burn_kcal).toBe(2650);
    expect(t.tdee_source).toBe("wearable");
  });
  it("men never go below 1,500 kcal eaten", () => {
    const t = computeTargets({ ...base, goal: "lose", goal_pace: "aggressive", measured_tdee: 1700 })!;
    expect(t.kcal).toBe(1500);
  });
  it("needs 7+ days of burn data to trust the wearable", () => {
    expect(measuredTdee([2500, 2600, 2700, 2400, 2550, 2650])).toBeNull();
    expect(measuredTdee([2500, 2600, 2700, 2400, 2550, 2650, 2450])).toBe(2550);
  });
});
