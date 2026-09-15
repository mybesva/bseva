/** Customer-facing copy for location / service-area checks. Never expose geo/DB details. */

export const COMING_SOON_TITLE = "We're Coming to Your Area Soon 🙏";

export const COMING_SOON_BODY =
  "BSeva services aren't available in your area just yet. We're actively expanding our network of trusted Pujaris and look forward to serving you soon.";

export const ENABLE_LOCATION_TITLE = "Enable Location to Check Service Availability";

export const ENABLE_LOCATION_BODY =
  "Please allow location access so BSeva can check service availability in your area.";

export const AVAILABILITY_ERROR_TITLE = "Couldn't Check Service Availability";

export const AVAILABILITY_ERROR_BODY =
  "We couldn't verify service availability right now. Please try again in a moment.";

export const SERVICE_AREA_UNAVAILABLE_CODE = "SERVICE_AREA_UNAVAILABLE";

export const BOOKING_UNAVAILABLE_HINT = "Booking isn't available in your area yet";

export function isServiceAreaUnavailableError(message: string | undefined | null): boolean {
  const msg = (message || "").trim();
  return msg === SERVICE_AREA_UNAVAILABLE_CODE || /SERVICE_AREA_UNAVAILABLE/i.test(msg);
}

export function friendlyBookingError(message: string | undefined | null): string {
  if (isServiceAreaUnavailableError(message)) return COMING_SOON_BODY;
  return (message || "").trim();
}
