import { VIRTUAL_COUNTRIES } from "./virtualCountries";

/** Customer booking UI matches web BookingWizard: Standard and Premium only. */
export const CUSTOMER_BOOKABLE_PACKAGES = ["standard", "premium"] as const;
export type CustomerBookablePackage = (typeof CUSTOMER_BOOKABLE_PACKAGES)[number];

export function customerBookablePackages(prices: {
  standard?: number | null;
  premium?: number | null;
}): CustomerBookablePackage[] {
  return CUSTOMER_BOOKABLE_PACKAGES.filter((key) => Number(prices[key] || 0) > 0);
}

export function virtualPujaCity(countryId: string): string {
  return VIRTUAL_COUNTRIES.find((c) => c.id === countryId)?.label || countryId;
}

export function virtualPujaLocationLabel(countryId: string, timezone: string): string {
  return `Virtual Puja · ${virtualPujaCity(countryId)} · ${timezone}`;
}

export function composePhysicalServiceAddress(input: {
  doorNumber?: string;
  street?: string;
  landmark?: string;
}): string {
  return [input.doorNumber, input.street, input.landmark]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join(", ");
}

export const RECURRING_OPTIONS = ["none", "weekly", "monthly", "selected_dates"] as const;

export const PHONE_COUNTRY_CODES = [
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "USA/Canada (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+86", label: "China (+86)" },
] as const;

export function toE164(countryCode: string, national: string): string {
  const digits = String(national || "").replace(/\D/g, "");
  const cc = String(countryCode || "+91").replace(/\s/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `${cc}${digits.replace(/^0+/, "")}`;
  if (cc === "+91" && digits.length === 10) return `+91${digits}`;
  if (national.trim().startsWith("+")) return `+${digits}`;
  return `${cc}${digits}`;
}

export function buildCreateBookingPayload(input: {
  service_id: string;
  package_type: string;
  mode: "in_person" | "virtual";
  booking_date: string;
  start_time: string;
  physicalAddress: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
  special_instructions?: string;
  include_samagri: boolean;
  include_alankaram: boolean;
  include_food: boolean;
  recurring: string;
  recurring_count?: number;
  selected_dates?: string[];
  customer_timezone?: string;
  customer_country?: string;
  idempotency_key?: string;
}): Record<string, unknown> {
  const isVirtual = input.mode === "virtual";
  const country = input.customer_country || "IN";
  const tz = input.customer_timezone || "Asia/Kolkata";
  const virtualLocation = virtualPujaLocationLabel(country, tz);
  const countryLabel = virtualPujaCity(country);
  const start = input.start_time.length === 5 ? `${input.start_time}:00` : input.start_time;
  const body: Record<string, unknown> = {
    service_id: input.service_id,
    package_type: input.package_type,
    mode: input.mode,
    booking_date: input.booking_date,
    start_time: start,
    location_label: isVirtual
      ? virtualLocation
      : `${input.physicalAddress}${input.city ? `, ${input.city}` : ""}`,
    address: isVirtual ? virtualLocation : input.physicalAddress,
    city: isVirtual ? countryLabel : input.city,
    special_instructions: input.special_instructions || undefined,
    terms_accepted: true,
    include_samagri: input.include_samagri,
    include_alankaram: input.include_alankaram,
    include_food: input.include_food,
    recurring: input.recurring,
    recurring_count:
      input.recurring === "none" || input.recurring === "selected_dates" ? undefined : input.recurring_count,
    selected_dates: input.recurring === "selected_dates" ? input.selected_dates : undefined,
    customer_timezone: isVirtual ? tz : undefined,
    customer_country: isVirtual ? country : undefined,
  };
  if (!isVirtual) {
    if (input.latitude != null) body.latitude = input.latitude;
    if (input.longitude != null) body.longitude = input.longitude;
  }
  if (input.idempotency_key) body.idempotency_key = input.idempotency_key;
  return body;
}
