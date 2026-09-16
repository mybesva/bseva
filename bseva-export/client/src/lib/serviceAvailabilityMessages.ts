/** Translation keys for customer-facing service-area checks. */
export const COMING_SOON_TITLE = "web.availability.comingSoonTitle";
export const COMING_SOON_BODY = "web.availability.comingSoonBody";
export const ENABLE_LOCATION_TITLE = "web.availability.enableTitle";
export const ENABLE_LOCATION_BODY = "web.availability.enableBody";
export const MY_ADDRESS_TITLE = "web.availability.addressTitle";
export const MY_ADDRESS_BODY = "web.availability.addressBody";
export const AVAILABILITY_ERROR_TITLE = "web.availability.errorTitle";
export const AVAILABILITY_ERROR_BODY = "web.availability.errorBody";

export const SERVICE_AREA_UNAVAILABLE_CODE = "SERVICE_AREA_UNAVAILABLE";

export const BOOKING_UNAVAILABLE_HINT = "web.availability.bookingUnavailable";

export function isServiceAreaUnavailableError(message: string | undefined | null): boolean {
  const msg = (message || "").trim();
  return msg === SERVICE_AREA_UNAVAILABLE_CODE || /SERVICE_AREA_UNAVAILABLE/i.test(msg);
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function friendlyBookingError(message: string | undefined | null, t: TranslateFn): string {
  if (isServiceAreaUnavailableError(message)) return t(COMING_SOON_BODY);
  const msg = (message || "").trim();
  if (msg === "Service not found") {
    return t("web.availability.serviceInactive");
  }
  return msg;
}
