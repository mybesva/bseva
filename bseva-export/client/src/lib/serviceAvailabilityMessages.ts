/** Customer-facing copy for location / service-area checks. Never expose geo/DB details. */

export const COMING_SOON_TITLE = "We're Coming to Your Area Soon 🙏";

export const COMING_SOON_BODY =
  "BSeva services aren't available in your area just yet. We're actively expanding our network of trusted Pujaris and look forward to serving you soon.";

export const ENABLE_LOCATION_TITLE = "Enable Location to Check Service Availability";

export const ENABLE_LOCATION_BODY =
  "Please allow location access so BSeva can check service availability in your area.";

export const MY_ADDRESS_TITLE = "Set Your Service Address";

export const MY_ADDRESS_BODY =
  "Please save your address in My Address and set the pin on the map. BSeva uses that location to check if booking is available in your area.";

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
  const msg = (message || "").trim();
  if (msg === "Service not found") {
    return "This puja could not be booked. It may be inactive or removed — please pick another service or contact support.";
  }
  return msg;
}
