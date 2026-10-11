const STORAGE_KEY = "bseva-booking-list-return";

/** Remember which booking list the user came from (customer web). */
export function rememberBookingListReturn(path: string) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, path);
}

export function bookingListReturnPath(fallback = "/customer/bookings"): string {
  if (typeof sessionStorage === "undefined") return fallback;
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return stored && stored.startsWith("/") ? stored : fallback;
}
