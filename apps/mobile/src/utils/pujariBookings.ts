import { bookingStartAt, isExpiredBooking, isUpcomingBooking, type PujariJobSegment } from "@bseva/config";
import type { Booking } from "@bseva/types";
import type { Href } from "expo-router";

export const PUJARI_DASHBOARD_PREVIEW_LIMIT = 4;
export const PUJARI_DASHBOARD_FEATURED_LIMIT = 3;

export type PujariBookingsDeepLinkStatus =
  | "all"
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";

/** Deep-link into the Bookings tab with segment + status pre-selected. */
export function pujariBookingsHref(segment: PujariJobSegment, status: PujariBookingsDeepLinkStatus): Href {
  return `/pujari/jobs?tab=${segment}&status=${status}` as Href;
}

export function compareBookingsBySchedule(a: Booking, b: Booking, direction: "asc" | "desc" = "asc"): number {
  const da = `${a.booking_date || ""}T${a.start_time || "00:00:00"}`;
  const db = `${b.booking_date || ""}T${b.start_time || "00:00:00"}`;
  const cmp = da.localeCompare(db);
  return direction === "asc" ? cmp : -cmp;
}

export function isPendingAcceptanceBooking(booking: Booking, now = new Date()): boolean {
  return (
    ["pending", "pending_acceptance"].includes(String(booking.status || "")) &&
    !isExpiredBooking(booking.status, booking.booking_date, booking.start_time, now)
  );
}

export function isReadyToStartBooking(booking: Booking, now = new Date()): boolean {
  return (
    booking.status === "confirmed" &&
    !isExpiredBooking(booking.status, booking.booking_date, booking.start_time, now)
  );
}

export function isOngoingBooking(booking: Booking, now = new Date()): boolean {
  if (isExpiredBooking(booking.status, booking.booking_date, booking.start_time, now)) return false;
  if (booking.status === "in_progress") return true;
  if (booking.status !== "confirmed") return false;
  const start = bookingStartAt(booking.booking_date, booking.start_time);
  if (!start) return false;
  const ms = start.getTime() - now.getTime();
  return ms <= 24 * 60 * 60 * 1000 && ms >= -2 * 60 * 60 * 1000;
}

export function bookingLocationLabel(booking: Booking): string | null {
  const label = String(booking.location_label || "").trim();
  if (label) return label;
  const address = String(booking.address || "").trim();
  if (!address) return null;
  const first = address.split(",")[0]?.trim();
  return first || address;
}

export function filterAndSortBookings(
  bookings: Booking[],
  predicate: (booking: Booking, now: Date) => boolean,
  now = new Date(),
): Booking[] {
  return bookings.filter((b) => predicate(b, now)).sort((a, b) => compareBookingsBySchedule(a, b, "asc"));
}

export function pujariDashboardStats(bookings: Booking[], now = new Date()) {
  const earningStatuses = new Set(["completed", "confirmed", "in_progress"]);
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let completedEarnings = 0;
  let monthEarnings = 0;
  let totalEarnings = 0;
  let upcomingCount = 0;
  let completedCount = 0;
  let pendingCount = 0;

  for (const b of bookings) {
    const expired = isExpiredBooking(b.status, b.booking_date, b.start_time, now);
    const payable = Number(b.pujari_payable_paise || 0);

    if (b.status === "completed") {
      completedCount += 1;
      completedEarnings += payable;
    }

    if (earningStatuses.has(String(b.status)) && !expired) {
      totalEarnings += payable;
      const dateKey = String(b.booking_date || "").slice(0, 7);
      if (dateKey === monthKey) monthEarnings += payable;
    }

    if (isUpcomingBooking(b.status, b.booking_date, b.start_time, now)) {
      upcomingCount += 1;
    }

    if (isPendingAcceptanceBooking(b, now) || (b.status === "confirmed" && !expired)) {
      pendingCount += 1;
    }
  }

  return { completedEarnings, monthEarnings, totalEarnings, upcomingCount, completedCount, pendingCount };
}
