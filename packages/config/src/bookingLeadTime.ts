/** Matches backend booking create: booking_start >= now + lead_hours */

export function earliestBookingInstant(leadHours: number, from: Date = new Date()): Date {
  const h = Math.max(1, leadHours || 48);
  return new Date(from.getTime() + h * 60 * 60 * 1000);
}

export function isCalendarDayBeforeLead(date: Date, leadHours: number, now: Date = new Date()): boolean {
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  return dayEnd < earliestBookingInstant(leadHours, now);
}

export function isCalendarDayDisabled(date: Date, leadHours: number, now: Date = new Date()): boolean {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  if (dayStart < todayStart) return true;
  return isCalendarDayBeforeLead(date, leadHours, now);
}

export function bookingLeadHintKey(leadHours: number): { key: string; days?: number } {
  const h = Math.max(1, leadHours || 48);
  if (h <= 2) return { key: "booking.lead2h" };
  if (h <= 24) return { key: "booking.lead24h" };
  if (h <= 48) return { key: "booking.lead2d" };
  if (h <= 72) return { key: "booking.lead3d" };
  return { key: "booking.leadDays", days: Math.ceil(h / 24) };
}

export function bookingLeadHint(leadHours: number): string {
  const h = Math.max(1, leadHours || 48);
  if (h <= 2) return "This puja can be booked at least 2 hours from now.";
  if (h <= 24) return "This puja must be booked at least 24 hours in advance.";
  if (h <= 48) return "This puja must be booked at least 2 days in advance.";
  if (h <= 72) return "This puja must be booked at least 3 days in advance.";
  const days = Math.ceil(h / 24);
  return `This puja must be booked at least ${days} days in advance.`;
}

/** True if date+HH:MM is earlier than now + lead hours (same rule as POST /bookings). */
export function isBookingDateTimeBeforeLead(
  dateIso: string,
  timeHm: string,
  leadHours: number,
  now: Date = new Date()
): boolean {
  const hm = (timeHm || "").trim();
  const stamp = `${dateIso}T${hm.length === 5 ? `${hm}:00` : hm}`;
  const start = new Date(stamp);
  if (Number.isNaN(start.getTime())) return true;
  return start < earliestBookingInstant(leadHours, now);
}

/** Same consultation slots as the working web Muhurtham widget. */
export const MUHURTA_TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"] as const;

/** Deprecated: Muhurtham consultation only uses MUHURTA_TIME_SLOTS. Puja booking time is free-form (web + mobile). */
export const BOOKING_TIME_SLOTS = [
  "06:00",
  "07:00",
  "08:00",
  ...MUHURTA_TIME_SLOTS,
] as const;
