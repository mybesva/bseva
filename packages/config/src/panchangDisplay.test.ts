import { describe, expect, it } from "vitest";
import {
  formatLunarPanchangDate,
  formatPanchangDateSubtitle,
  formatSolarMonthLabel,
  formatPanchangSelectedDate,
  formatSolarPanchangDate,
  panchangApiCalendarParam,
} from "./panchangDisplay";

describe("panchangDisplay", () => {
  const sample = {
    tithi: "Dwitiya",
    paksha: "Shukla Paksha",
    lunarMonth: "Chaitra",
    lunarDay: 2,
  };

  it("formats solar date as DD-MM-YYYY", () => {
    expect(formatSolarPanchangDate("2026-09-27")).toBe("27-09-2026");
  });

  it("formats lunar label from API fields", () => {
    expect(formatLunarPanchangDate(sample)).toBe("Chaitra · Dwitiya (Shukla Paksha) · Day 2");
  });

  it("switches primary label by calendar type", () => {
    expect(formatPanchangSelectedDate("solar", "2026-09-27", sample)).toBe("27-09-2026");
    expect(formatPanchangSelectedDate("lunar", "2026-09-27", sample)).toContain("Chaitra");
  });

  it("shows Gregorian subtitle in lunar mode", () => {
    expect(formatPanchangDateSubtitle("lunar", "2026-09-27", sample)).toBe("27-09-2026");
  });

  it("normalizes API calendar param", () => {
    expect(panchangApiCalendarParam("lunar")).toBe("lunar");
    expect(panchangApiCalendarParam("solar")).toBe("solar");
  });

  it("solar subtitle shows the solar month and day, not lunar tithi info", () => {
    const solar = { tithi: "Chaturdashi", paksha: "Krishna Paksha", lunarMonth: "Purattasi", lunarDay: 23, solarMonth: "Purattasi", solarDay: 23 };
    expect(formatPanchangDateSubtitle("solar", "2026-10-09", solar)).toBe("Purattasi · Day 23");
    expect(formatSolarMonthLabel({ solarMonth: "Aippasi", solarDay: 1 })).toBe("Aippasi · Day 1");
    expect(formatSolarMonthLabel(null)).toBeNull();
  });
});
