export const APP_NAME = "BSeva";

export const ROLES = ["customer", "pujari", "head_pujari", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

export const CUSTOMER_ROLES = ["customer"] as const;
export const PUJARI_ROLES = ["pujari", "head_pujari"] as const;
export const ADMIN_ROLES = ["admin", "super_admin"] as const;

export function isCustomerRole(role: string | null | undefined): boolean {
  return role === "customer";
}

export function isPujariRole(role: string | null | undefined): boolean {
  return role === "pujari" || role === "head_pujari" || role === "priest";
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

export const BOOKING_STATUSES = [
  "pending",
  "pending_acceptance",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "rejected",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const ACTIVE_BOOKING_STATUSES = [
  "pending",
  "pending_acceptance",
  "confirmed",
  "in_progress",
] as const;

export const DONE_BOOKING_STATUSES = ["completed", "cancelled", "rejected", "refunded"] as const;

export const LANGS = ["en", "hi", "te"] as const;
export type LangCode = (typeof LANGS)[number];

export const CALENDARS = ["north", "south", "lunar"] as const;
export type CalendarPref = (typeof CALENDARS)[number];

export const TERMS_VERSION = "2026-01";
export const PRIVACY_VERSION = "2026-01";

export const REGISTRATION_CONSENT_LABEL =
  "I agree to the BSeva Terms & Conditions and Privacy Policy and consent to BSeva collecting, storing and processing the information I provide for operating the platform and providing requested services.";

export const PUJARI_FINAL_CONSENT_LABEL =
  "I confirm that the information and documents submitted are accurate and I agree to the BSeva Terms & Conditions, Privacy Policy and applicable Pujari verification requirements.";

export const PUJARI_QUALS = [
  { id: "panchadasha", label: "Panchadasha Karma" },
  { id: "kriya_kovida", label: "Kriya Kovida" },
  { id: "vidya_visharada", label: "Vidya Visharada" },
] as const;

export const PUJARI_LANGS = ["Sanskrit", "Hindi", "English", "Telugu", "Kannada", "Tamil", "Marathi"] as const;
export const PUJARI_SPECS = ["Satyanarayan Puja", "Griha Pravesh", "Wedding", "Havan", "Vastu Shanti", "Namkaran"] as const;
export const SAMPRADAYA_OPTS = ["smarta", "madhwa", "vaishnava"] as const;
export const PUJARI_DOC_TYPES = [
  { id: "identity", label: "Aadhaar (required)" },
  { id: "certificate", label: "Professional certificate" },
  { id: "supporting", label: "Additional documents" },
] as const;
export const CUSTOMER_SUPPORT_CATS = ["Payments", "Wallet", "Bookings", "Others"] as const;
export const PUJARI_SUPPORT_CATS = ["Settlement", "Route Map / Location", "Bookings", "Others"] as const;

export function rupees(paise: number | null | undefined): string {
  return `₹${(Number(paise || 0) / 100).toLocaleString("en-IN")}`;
}

export function dashboardPath(role: string): "/customer" | "/pujari" | "admin-web" {
  if (isAdminRole(role)) return "admin-web";
  if (isPujariRole(role)) return "/pujari";
  return "/customer";
}

export function formatApiError(detail: unknown, fallback = "Request failed"): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(", ") || fallback;
  }
  return fallback;
}
