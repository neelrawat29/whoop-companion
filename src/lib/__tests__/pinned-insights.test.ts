import { describe, it, expect } from "vitest";
import { habitPinSource, stalePins, type PinnedInsight } from "../pinned-insights";
import type { HabitFinding } from "../habit-insights";

const finding = (id: string, sentence: string) => ({ id, label: id, sentence, primary: {} as any, also: [] }) as HabitFinding;
const pin = (id: string, source: string | null, content: string): PinnedInsight => ({ id, source, content, created_at: "2026-10-30T00:00:00Z" });

describe("pinned insights", () => {
  it("uses habit:<id> as the source", () => {
    expect(habitPinSource("alcohol")).toBe("habit:alcohol");
  });

  it("updates only pins whose finding text changed", () => {
    const pins = [pin("1", "habit:alcohol", "old text"), pin("2", "habit:high-strain", "same"), pin("3", "habit:gone", "keep me"), pin("4", null, "chat pin")];
    const findings = [finding("alcohol", "new text"), finding("high-strain", "same")];
    expect(stalePins(pins, findings)).toEqual([{ id: "1", content: "new text" }]);
  });
});
