/** Local ISO date helpers for Panchangam (local calendar day, no UTC shift). */

export const DEFAULT_PANCHANG_CALENDAR = "lunar" as const;

export function todayIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDaysToIsoDate(iso: string, delta: number): string {
  const d = parseIsoDateLocal(iso);
  d.setDate(d.getDate() + delta);
  return todayIsoDate(d);
}

export function isTodayIsoDate(iso: string, now: Date = new Date()): boolean {
  return iso.slice(0, 10) === todayIsoDate(now);
}

export function formatDisplayDate(iso: string): string {
  const d = parseIsoDateLocal(iso);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function toIsoDateInput(d: Date): string {
  return todayIsoDate(d);
}

export type PanchangDateParts = {
  tithi?: string;
  paksha?: string | null;
  lunarMonth?: string;
  lunarDay?: number | null;
};

export type PanchangCalendarType = "lunar" | "solar";

export function formatSolarPanchangDate(iso: string): string {
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function formatLunarPanchangDate(data: PanchangDateParts | null | undefined): string | null {
  if (!data?.tithi || !data.lunarMonth) return null;
  const day = data.lunarDay != null ? ` · Day ${data.lunarDay}` : "";
  const paksha = data.paksha ? ` (${data.paksha})` : "";
  return `${data.lunarMonth} · ${data.tithi}${paksha}${day}`;
}

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

export function formatPanchangDateSubtitle(
  calendarType: PanchangCalendarType,
  isoDate: string,
  data?: PanchangDateParts | null,
): string | null {
  if (calendarType === "lunar") {
    return formatSolarPanchangDate(isoDate);
  }
  return formatLunarPanchangDate(data);
}
