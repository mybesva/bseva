const TERMINAL = new Set(["completed", "cancelled", "refunded"]);

export const PUJARI_JOB_SEGMENTS = ["all", "upcoming", "completed", "cancelled", "expired"] as const;
export type PujariJobSegment = (typeof PUJARI_JOB_SEGMENTS)[number];

export function isTerminalBookingStatus(status: string | null | undefined): boolean {
  return TERMINAL.has(String(status || ""));
}

export function bookingStartAt(
  bookingDate: string | Date | null | undefined,
  bookingTime?: string | null
): Date | null {
  if (!bookingDate) return null;
  const d = new Date(bookingDate);
  if (Number.isNaN(d.getTime())) return null;
  const t = (bookingTime || "").trim();
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    d.setHours(Number(m[1]), Number(m[2]), Number(m[3] || 0), 0);
  } else {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

export function isExpiredBooking(
  status: string | null | undefined,
  bookingDate: string | Date | null | undefined,
  bookingTime?: string | null,
  now = new Date()
): boolean {
  if (isTerminalBookingStatus(status)) return false;
  const start = bookingStartAt(bookingDate, bookingTime);
  if (!start) return false;
  return start.getTime() < now.getTime();
}

export function isUpcomingBooking(
  status: string | null | undefined,
  bookingDate: string | Date | null | undefined,
  bookingTime?: string | null,
  now = new Date()
): boolean {
  if (isTerminalBookingStatus(status)) return false;
  if (isExpiredBooking(status, bookingDate, bookingTime, now)) return false;
  return true;
}

export function matchesPujariJobSegment(
  segment: PujariJobSegment,
  status: string | null | undefined,
  bookingDate: string | Date | null | undefined,
  bookingTime?: string | null,
  now = new Date()
): boolean {
  const st = String(status || "");
  if (segment === "upcoming") return isUpcomingBooking(st, bookingDate, bookingTime, now);
  if (segment === "completed") return st === "completed";
  if (segment === "cancelled") return st === "cancelled" || st === "refunded";
  if (segment === "expired") return isExpiredBooking(st, bookingDate, bookingTime, now);
  return true;
}
