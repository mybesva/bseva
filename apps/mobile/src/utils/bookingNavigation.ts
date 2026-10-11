import type { Router } from "expo-router";

export type BookingReturnTarget = "/customer/(tabs)/more" | "/customer/(tabs)/bookings" | "/pujari/(tabs)/jobs";

export function bookingDetailParams(returnTo: BookingReturnTarget) {
  return { returnTo };
}

export function navigateBackToBookingList(
  router: Pick<Router, "back" | "replace" | "canGoBack">,
  returnTo?: string | string[],
) {
  const target = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  if (target && typeof target === "string" && target.startsWith("/")) {
    router.replace(target as never);
    return;
  }
  if (router.canGoBack?.()) {
    router.back();
    return;
  }
  router.replace("/customer/(tabs)/bookings" as never);
}
