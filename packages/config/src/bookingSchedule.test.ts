import { describe, expect, it } from "vitest";
import { isExpiredBooking, isUpcomingBooking, matchesPujariJobSegment } from "./bookingSchedule";

describe("bookingSchedule", () => {
  const now = new Date("2026-09-20T12:00:00");

  it("treats past non-terminal bookings as expired", () => {
    expect(isExpiredBooking("confirmed", "2026-09-19", "10:00", now)).toBe(true);
    expect(isUpcomingBooking("confirmed", "2026-09-19", "10:00", now)).toBe(false);
  });

  it("does not expire completed bookings", () => {
    expect(isExpiredBooking("completed", "2026-09-19", "10:00", now)).toBe(false);
  });

  it("matches pujari job segments like web BookingsPage", () => {
    expect(matchesPujariJobSegment("upcoming", "confirmed", "2026-09-21", "10:00", now)).toBe(true);
    expect(matchesPujariJobSegment("completed", "completed", "2026-09-19", "10:00", now)).toBe(true);
    expect(matchesPujariJobSegment("cancelled", "refunded", "2026-09-19", "10:00", now)).toBe(true);
    expect(matchesPujariJobSegment("expired", "confirmed", "2026-09-19", "10:00", now)).toBe(true);
  });
});
