import { describe, it, expect } from "vitest";
import { computeTargets } from "../targets.shared";

const base = { sex: "male" as const, height_cm: 180, weight_kg: 80, birth_year: new Date().getFullYear() - 30, activity_level: "moderate" as const };

describe("eaten vs burned targets", () => {
  it("lose: eaten is 500 kcal below burned", () => {
    const t = computeTargets({ ...base, goal: "lose" })!;
    expect(t.burn_kcal - t.kcal).toBe(500);
  });
  it("gain: eaten is 300 kcal above burned", () => {
    const t = computeTargets({ ...base, goal: "gain" })!;
    expect(t.kcal - t.burn_kcal).toBe(300);
  });
  it("burned target is the same maintenance energy for every goal", () => {
    const l = computeTargets({ ...base, goal: "lose" })!;
    const g = computeTargets({ ...base, goal: "gain" })!;
    expect(l.burn_kcal).toBe(g.burn_kcal);
  });
});
