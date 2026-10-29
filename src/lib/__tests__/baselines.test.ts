import { describe, it, expect } from "vitest";
import { computeMetricBaseline, rangeBefore, type BaselineEntry } from "../baselines";

function day(i: number) {
  return new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
}

function entries(hrvs: (number | null)[]): BaselineEntry[] {
  return hrvs.map((h, i) => ({ entry_date: day(i), hrv: h, rhr: null, sleep_hours: null }));
}

describe("personal baselines", () => {
  it("needs 14 days of history before showing a range", () => {
    const e = entries(Array.from({ length: 10 }, () => 60));
    const b = computeMetricBaseline("hrv", e);
    expect(b.range).toBeNull();
    expect(b.summary).toMatch(/after 14 days of data \(9 so far\)/);
  });

  it("range excludes the day being judged", () => {
    const values = new Map<string, number>();
    for (let i = 0; i < 20; i++) values.set(day(i), i % 2 ? 50 : 70);
    values.set(day(20), 10);
    const r = rangeBefore(values, day(20))!;
    expect(r.mean).toBeCloseTo(60);
    expect(r.low).toBeGreaterThan(40);
  });

  it("flags HRV below range and counts the run", () => {
    // Alternating 55/65 then a steady 60 — the 60s sit well inside the range.
    const hrv: number[] = Array.from({ length: 30 }, (_, i) => (i < 26 ? (i % 2 ? 55 : 65) : 60));
    hrv.push(45, 44, 43);
    const b = computeMetricBaseline("hrv", entries(hrv));
    expect(b.status).toBe("below");
    expect(b.concerning).toBe(true);
    expect(b.streak).toBe(3);
    expect(b.summary).toBe("HRV is below your usual range for the 3rd day running.");
  });

  it("high resting heart rate is the concerning direction", () => {
    const e: BaselineEntry[] = Array.from({ length: 20 }, (_, i) => ({ entry_date: day(i), hrv: null, rhr: i % 2 ? 50 : 52, sleep_hours: null }));
    e.push({ entry_date: day(20), hrv: null, rhr: 60, sleep_hours: null });
    const b = computeMetricBaseline("rhr", e);
    expect(b.status).toBe("above");
    expect(b.concerning).toBe(true);
    expect(b.summary).toBe("Resting heart rate is above your usual range.");
  });

  it("missing days don't break the run", () => {
    const hrv: (number | null)[] = Array.from({ length: 30 }, (_, i) => (i % 2 ? 58 : 62));
    hrv.push(60, null, 61);
    const b = computeMetricBaseline("hrv", entries(hrv));
    expect(b.status).toBe("within");
    expect(b.streak).toBeGreaterThanOrEqual(2);
  });

  it("series covers the last 30 days with each day's own range", () => {
    const b = computeMetricBaseline("hrv", entries(Array.from({ length: 60 }, (_, i) => 55 + (i % 5))));
    expect(b.series.length).toBe(30);
    expect(b.series.every((p) => p.low != null && p.high != null)).toBe(true);
  });

  it("ignores zero values", () => {
    const b = computeMetricBaseline("sleep_hours", [{ entry_date: day(0), hrv: null, rhr: null, sleep_hours: 0 }]);
    expect(b.latest).toBeNull();
  });
});

describe("baseline display consistency", () => {
  it("judges status on shown (rounded) numbers and formats the range compactly", () => {
    // Range high lands just under 54; a value of 54.2 shows as 54 and must count as within.
    const hrv: number[] = Array.from({ length: 30 }, (_, i) => (i % 2 ? 44 : 53.6));
    hrv.push(54.2);
    const b = computeMetricBaseline("hrv", entries(hrv));
    expect(b.range!.text).toMatch(/^\d+–\d+ ms$/);
    const [lo, hi] = b.range!.text.replace(" ms", "").split("–").map(Number);
    const shown = Math.round(54.2);
    const expected = shown < lo ? "below" : shown > hi ? "above" : "within";
    expect(b.status).toBe(expected);
  });
});
