import { describe, expect, it } from "vitest";
import { addDaysToIsoDate, isTodayIsoDate, todayIsoDate } from "./panchangDates";

describe("panchangDates", () => {
  it("adds and subtracts days without UTC shift", () => {
    expect(addDaysToIsoDate("2026-09-27", 1)).toBe("2026-09-28");
    expect(addDaysToIsoDate("2026-09-27", -1)).toBe("2026-09-26");
    expect(addDaysToIsoDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("detects today", () => {
    const today = todayIsoDate(new Date(2026, 8, 27));
    expect(today).toBe("2026-09-27");
    expect(isTodayIsoDate("2026-09-27", new Date(2026, 8, 27))).toBe(true);
    expect(isTodayIsoDate("2026-09-26", new Date(2026, 8, 27))).toBe(false);
  });
});
