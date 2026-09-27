import { parseIsoDateLocal } from "./panchangDates";

export type PanchangCalendarType = "lunar" | "solar";

/** Panchang fields used to render a lunar calendar date label (from API, not hardcoded). */
export type PanchangDateParts = {
  tithi?: string;
  paksha?: string | null;
  lunarMonth?: string;
  lunarDay?: number | null;
};

export function formatIsoDateDdMmYyyy(iso: string): string {
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Compact Gregorian label for Panchangam solar mode (DD-MM-YYYY). */
export function formatSolarPanchangDate(iso: string): string {
  return formatIsoDateDdMmYyyy(iso);
}

/** Lunar date label derived from Panchangam API response for the selected Gregorian day. */
export function formatLunarPanchangDate(data: PanchangDateParts | null | undefined): string | null {
  if (!data?.tithi || !data.lunarMonth) return null;
  const day = data.lunarDay != null ? ` · Day ${data.lunarDay}` : "";
  const paksha = data.paksha ? ` (${data.paksha})` : "";
  return `${data.lunarMonth} · ${data.tithi}${paksha}${day}`;
}

/**
 * Primary date label for the Panchangam header.
 * Solar mode uses the selected Gregorian date; lunar mode uses API lunar fields when available.
 */
export function formatPanchangSelectedDate(
  calendarType: PanchangCalendarType,
  isoDate: string,
  data?: PanchangDateParts | null,
): string {
  if (calendarType === "lunar") {
    return formatLunarPanchangDate(data) ?? formatSolarPanchangDate(isoDate);
  }
  return formatSolarPanchangDate(isoDate);
}

/** Secondary hint under the primary date (Gregorian when lunar mode is active). */
export function formatPanchangDateSubtitle(
  calendarType: PanchangCalendarType,
  isoDate: string,
  data?: PanchangDateParts | null,
): string | null {
  if (calendarType === "lunar") {
    return formatSolarPanchangDate(isoDate);
  }
  const lunar = formatLunarPanchangDate(data);
  return lunar;
}

/** API query calendar param — matches backend normalize_calendar_pref. */
export function panchangApiCalendarParam(calendarType: PanchangCalendarType): PanchangCalendarType {
  return calendarType === "lunar" ? "lunar" : "solar";
}

/** Canonical Gregorian ISO for API requests from a local Date (no UTC shift). */
export function isoDateFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localDateFromIso(iso: string): Date {
  return parseIsoDateLocal(iso);
}
