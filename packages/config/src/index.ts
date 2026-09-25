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

export const LANGS = ["en", "hi", "te", "mr", "ta", "kn", "ml"] as const;
export type LangCode = (typeof LANGS)[number];

export const PREFERRED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "te", label: "తెలుగు" },
  { code: "hi", label: "हिन्दी" },
  { code: "mr", label: "मराठी" },
  { code: "ta", label: "தமிழ்" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ml", label: "മലയാളം" },
] as const;

export function isLangCode(code: string | null | undefined): code is LangCode {
  return !!code && (LANGS as readonly string[]).includes(code);
}

export const ADMIN_PERMISSIONS = [
  "view_customers",
  "create_customers",
  "edit_customers",
  "view_pujaris",
  "create_pujaris",
  "edit_pujaris",
  "approve_pujaris",
  "verify_pujaris",
  "block_pujaris",
  "view_bookings",
  "manage_bookings",
  "view_payments",
  "manage_settlements",
  "manage_services",
  "manage_samagri",
  "manage_promotions",
  "manage_config",
  "manage_admins",
  "manage_support",
  "manage_legal",
  "view_reports",
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export function hasAdminPermission(
  role: string | null | undefined,
  permissions: string[] | null | undefined,
  needed?: string | string[]
): boolean {
  if (role === "super_admin") return true;
  if (role !== "admin") return false;
  if (!needed || (Array.isArray(needed) && needed.length === 0)) return true;
  const have = permissions || [];
  const list = Array.isArray(needed) ? needed : [needed];
  return list.some((p) => have.includes(p));
}

export const CALENDARS = ["lunar", "solar"] as const;
export type CalendarPref = (typeof CALENDARS)[number];

export function normalizeCalendarPref(value?: string | null): CalendarPref {
  return value === "lunar" ? "lunar" : "solar";
}

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
export const PUJARI_SPECS = [
  "Satyanarayan Puja",
  "Gruha Pravesam",
  "Wedding",
  "Brahmana Wedding",
  "Homalu",
  "Vastu Shanti",
  "Namkaran",
  "Upanayanam",
  "Santhulu",
  "Pitru Karma",
  "Alankaram",
] as const;
/** Backend Literal: smartha | madhwa | vaishnava */
export const SAMPRADAYA_OPTS = ["smartha", "madhwa", "vaishnava"] as const;
export const PUJARI_DOC_TYPES = [
  { id: "identity", label: "Aadhaar (required)" },
  { id: "driving_licence", label: "Driving Licence" },
  { id: "certificate", label: "Professional certificate" },
  { id: "supporting", label: "Additional documents" },
] as const;
export const CUSTOMER_SUPPORT_CATS = [
  "booking",
  "payment",
  "cancellation_refund",
  "puja_seva",
  "samagri",
  "rescheduling",
  "technical",
  "other",
] as const;
export const PUJARI_SUPPORT_CATS = [
  "booking",
  "payment",
  "puja_seva",
  "pujari",
  "samagri",
  "rescheduling",
  "technical",
  "other",
] as const;

export function rupees(paise: number | null | undefined): string {
  return `₹${(Number(paise || 0) / 100).toLocaleString("en-IN")}`;
}

export function dashboardPath(role: string): "/customer" | "/pujari" | "admin-web" {
  if (isAdminRole(role)) return "admin-web";
  if (isPujariRole(role)) return "/pujari";
  return "/customer";
}

/** Map backend/web notification `link` values onto React Native routes. */
export function mapNotificationLinkToMobile(
  link: string | null | undefined,
  app: "consumer" | "admin"
): string {
  const raw = (link || "/").trim() || "/";
  let path = raw;
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const u = new URL(raw);
      path = `${u.pathname}${u.search}`;
    }
  } catch {
    path = raw.startsWith("/") ? raw : `/${raw}`;
  }
  if (!path.startsWith("/")) path = `/${path}`;

  const [pathname, search = ""] = path.split("?");
  const qs = search ? `?${search}` : "";

  if (app === "admin") {
    const rest = pathname === "/admin" || pathname.startsWith("/admin/")
      ? pathname.slice("/admin".length) || "/"
      : pathname.startsWith("/bseva-ops")
        ? pathname.replace(/^\/bseva-ops[^/]*/, "") || "/"
        : pathname;
    if (rest === "/" || rest === "") return "/(app)";
    const pujariDetail = rest.match(/^\/pujaris\/([^/]+)$/);
    if (pujariDetail) return `/pujari/${pujariDetail[1]}${qs}`;
    if (rest === "/pujaris") return "/(app)/pujaris";
    const bookingDetail = rest.match(/^\/bookings\/([^/]+)$/);
    if (bookingDetail) return `/booking/${bookingDetail[1]}${qs}`;
    if (rest === "/bookings") return "/(app)/bookings";
    return rest.startsWith("/") ? `${rest}${qs}` : `/${rest}${qs}`;
  }

  const booking = pathname.match(/^\/booking\/([^/]+)$/);
  if (booking) return `/customer/booking/${booking[1]}${qs}`;
  if (pathname === "/my-bookings" || pathname === "/customer/bookings") return `/customer/bookings${qs}`;
  if (pathname === "/customer/notifications") return `/customer/notifications${qs}`;
  if (pathname === "/pujari/notifications") return `/pujari/notifications${qs}`;
  if (pathname === "/pujari/bookings") return `/pujari/jobs${qs}`;
  const pujariBooking = pathname.match(/^\/pujari\/bookings\/([^/]+)$/);
  if (pujariBooking) return `/pujari/booking/${pujariBooking[1]}${qs}`;
  const join = pathname.match(/^\/join\/([^/]+)$/);
  if (join) return `/join/${join[1]}${qs}`;
  const service = pathname.match(/^\/services\/([^/]+)$/);
  if (service) return `/service/${service[1]}${qs}`;
  const book = pathname.match(/^\/book\/([^/]+)$/);
  if (book) return `/customer/book/${book[1]}${qs}`;
  if (pathname === "/astrology") return `/customer/astrology${qs}`;
  if (pathname === "/customer" || pathname.startsWith("/customer/")) return `${pathname}${qs}`;
  if (pathname === "/pujari" || pathname.startsWith("/pujari/")) return `${pathname}${qs}`;
  return `${pathname}${qs}`;
}

export function parseApiError(detail: unknown, fallback = "Request failed"): { message: string; code?: string } {
  if (typeof detail === "string" && detail.trim()) return { message: detail };
  if (Array.isArray(detail)) {
    const msgs = detail.map((d: { msg?: string; message?: string }) => d?.msg || d?.message).filter(Boolean) as string[];
    return { message: msgs.join(", ") || fallback, code: "VALIDATION" };
  }
  if (detail && typeof detail === "object") {
    const d = detail as { code?: string; message?: string; msg?: string };
    return { message: (d.message || d.msg || fallback).trim() || fallback, code: d.code };
  }
  return { message: fallback };
}

export function formatApiError(detail: unknown, fallback = "Request failed"): string {
  return parseApiError(detail, fallback).message;
}

export {
  BOOKING_TIME_SLOTS,
  MUHURTA_TIME_SLOTS,
  bookingLeadHint,
  bookingLeadHintKey,
  earliestBookingInstant,
  isBookingDateTimeBeforeLead,
  isCalendarDayBeforeLead,
  isCalendarDayDisabled,
} from "./bookingLeadTime";
export { isDeathRelatedService } from "./serviceCategories";
export { VIRTUAL_COUNTRIES } from "./virtualCountries";
export {
  CUSTOMER_BOOKABLE_PACKAGES,
  PHONE_COUNTRY_CODES,
  RECURRING_OPTIONS,
  buildCreateBookingPayload,
  composePhysicalServiceAddress,
  customerBookablePackages,
  toE164,
  virtualPujaCity,
  virtualPujaLocationLabel,
  type CustomerBookablePackage,
} from "./bookingParity";
export {
  PUJARI_SPECIALIZATIONS,
  mergeSpecializations,
  specializationKey,
  type PujariSpecialization,
} from "./pujariSpecializations";
export { dateInputToIsoEnd, dateInputToIsoStart } from "./isoDateBounds";
export {
  PUJARI_JOB_SEGMENTS,
  bookingStartAt,
  isExpiredBooking,
  isTerminalBookingStatus,
  isUpcomingBooking,
  matchesPujariJobSegment,
  type PujariJobSegment,
} from "./bookingSchedule";
export { priestShare, pujariEarningsStats, settlementAmountPaise } from "./pujariEarnings";
export {
  EMPTY_PROMO_BANNER,
  EMPTY_PROMO_POPUP,
  PROMO_AUDIENCES,
  PROMO_PLACEMENTS,
  promoBannerBody,
  promoPopupBody,
  validatePromoBanner,
  validatePromoPopup,
  type PromoBannerForm,
  type PromoPopupForm,
} from "./promoParity";
export {
  EMPTY_SUPPORT_TICKET,
  SUPPORT_CATEGORIES,
  SUPPORT_CONTACT_SOURCES,
  SUPPORT_ESCALATIONS,
  SUPPORT_NOTE_KINDS,
  SUPPORT_PRIORITIES,
  SUPPORT_REPORTER_TYPES,
  SUPPORT_RESOLUTIONS,
  TICKET_STATUSES,
} from "./supportTicketForm";
export {
  adminServiceActivationError,
  buildAdminServicePayload,
  emptyAdminServiceForm,
  emptyServiceCategoryForm,
  paiseFromRupees,
  parseAliasList,
  rupeesField,
  slugFromName,
  type AdminServiceForm,
} from "./serviceForm";
export {
  buildReportSheetTables,
  reportWorkbookFilename,
  type ReportCell,
  type ReportSheetTable,
  type ReportWorkbookData,
} from "./reportSheets";
