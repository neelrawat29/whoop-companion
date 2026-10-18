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
  it("gives muscle gain 800 kcal more than fat loss", () => {
    const lose = computeTargets({ ...base, goal: "lose" })!;
    const gain = computeTargets({ ...base, goal: "gain" })!;
    expect(gain.kcal - lose.kcal).toBe(800);
    expect(lose.protein_g).toBe(144);
  });
  it("returns WHOOP connections to the setup page", () => {
    expect(whoopCallbackLocation("http://localhost:8080/onboarding", "connected")).toBe("http://localhost:8080/onboarding?whoop=connected");
  });
});
