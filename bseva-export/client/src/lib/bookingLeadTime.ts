/** Matches backend booking create: booking_start >= now + lead_hours */

export function earliestBookingInstant(leadHours: number, from: Date = new Date()): Date {
  const h = Math.max(1, leadHours || 48);
  return new Date(from.getTime() + h * 60 * 60 * 1000);
}

/** True if no slot on this calendar day can satisfy the lead-time rule (date-only picker). */
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

export function bookingLeadHint(leadHours: number): string {
  const h = Math.max(1, leadHours || 48);
  if (h <= 2) return "This puja can be booked at least 2 hours from now.";
  if (h <= 24) return "This puja must be booked at least 24 hours in advance.";
  if (h <= 48) return "This puja must be booked at least 2 days in advance.";
  if (h <= 72) return "This puja must be booked at least 3 days in advance.";
  const days = Math.ceil(h / 24);
  return `This puja must be booked at least ${days} days in advance.`;
}
