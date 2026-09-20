import { describe, expect, it } from "vitest";
import { earliestBookingInstant, isBookingDateTimeBeforeLead } from "./bookingLeadTime";

describe("isBookingDateTimeBeforeLead", () => {
  const now = new Date("2026-09-20T08:00:00");

  it("rejects a start inside the lead window", () => {
    expect(isBookingDateTimeBeforeLead("2026-09-21", "10:15", 48, now)).toBe(true);
  });

  it("allows any minute after the lead window", () => {
    expect(isBookingDateTimeBeforeLead("2026-09-23", "10:15", 48, now)).toBe(false);
    expect(isBookingDateTimeBeforeLead("2026-09-23", "13:20", 48, now)).toBe(false);
  });

  it("matches earliestBookingInstant", () => {
    const earliest = earliestBookingInstant(2, now);
    const iso = earliest.toISOString().slice(0, 10);
    expect(earliest.getTime()).toBeGreaterThan(now.getTime());
    expect(iso >= "2026-09-20").toBe(true);
  });
});
