import { describe, expect, it } from "vitest";
import { onboardingProfileSchema } from "../onboarding.shared";
import { computeTargets } from "../targets.shared";
import { whoopCallbackLocation } from "../whoop-return";

const base = { sex: "male" as const, height_cm: 180, weight_kg: 80, birth_year: new Date().getFullYear() - 30, activity_level: "moderate" as const };

describe("onboarding", () => {
  it("rejects setup without weight", () => {
    const { weight_kg: _w, ...rest } = base;
    expect(onboardingProfileSchema.safeParse({ ...rest, goal: "lose" }).success).toBe(false);
  });
  it("sizes fat loss to 0.5% body weight per week", () => {
    const lose = computeTargets({ ...base, goal: "lose" })!;
    const gain = computeTargets({ ...base, goal: "gain" })!;
    expect(lose.delta_kcal).toBe(-Math.round(base.weight_kg * 0.005 * 7700 / 7)); expect(gain.kcal).toBeGreaterThan(lose.kcal);
    expect(lose.protein_g).toBe(144);
  });
  it("returns WHOOP connections to the setup page", () => {
    expect(whoopCallbackLocation("http://localhost:8080/onboarding", "connected")).toBe("http://localhost:8080/onboarding?whoop=connected");
  });
});
