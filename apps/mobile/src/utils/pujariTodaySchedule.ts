import { isExpiredBooking } from "@bseva/config";
import type { Booking } from "@bseva/types";
import { compareBookingsBySchedule } from "@/utils/pujariBookings";

const ACTIVE_STATUSES = new Set(["pending", "pending_acceptance", "confirmed", "in_progress"]);

function isSameLocalDay(dateStr: string | undefined, now: Date): boolean {
  if (!dateStr) return false;
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  return (
    Number(m[1]) === now.getFullYear() &&
    Number(m[2]) === now.getMonth() + 1 &&
    Number(m[3]) === now.getDate()
  );
}

export function pujariTodayScheduleBookings(bookings: Booking[], now = new Date(), limit = 3): Booking[] {
  return bookings
    .filter((b) => {
      if (!isSameLocalDay(b.booking_date, now)) return false;
      if (!ACTIVE_STATUSES.has(String(b.status || ""))) return false;
      return !isExpiredBooking(b.status, b.booking_date, b.start_time, now);
    })
    .sort((a, b) => compareBookingsBySchedule(a, b, "asc"))
    .slice(0, limit);
}
