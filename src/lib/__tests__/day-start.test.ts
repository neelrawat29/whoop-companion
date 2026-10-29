import { describe, it, expect } from "vitest";
import { DAY_START_HOUR, shiftDay, today } from "../recovery";

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);

describe("app day starts at 4am", () => {
  it("uses 4am", () => expect(DAY_START_HOUR).toBe(4));
  it("stays on the previous day until 4am", () => {
    expect(today(at(2026, 10, 30, 0, 36))).toBe("2026-10-29");
    expect(today(at(2026, 10, 30, 3, 59))).toBe("2026-10-29");
    expect(today(at(2026, 10, 30, 4, 0))).toBe("2026-10-30");
    expect(today(at(2026, 10, 30, 23, 59))).toBe("2026-10-30");
  });
  it("crosses month and year boundaries", () => {
    expect(today(at(2026, 11, 1, 1))).toBe("2026-10-31");
    expect(today(at(2027, 1, 1, 2))).toBe("2026-12-31");
  });
  it("shifts days", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2026-10-29", 1)).toBe("2026-10-30");
  });
});
