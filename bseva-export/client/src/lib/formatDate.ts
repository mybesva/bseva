import { format, isValid, parseISO } from "date-fns";

/** Display dates as day-month-year (DD-MM-YYYY). Keep API payloads as yyyy-MM-dd. */

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  const s = String(value).trim();
  if (!s) return null;
  // Prefer date-only YYYY-MM-DD to avoid UTC day shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = parseISO(s);
    return isValid(d) ? d : null;
  }
  const iso = parseISO(s);
  if (isValid(iso)) return iso;
  const d = new Date(s);
  return isValid(d) ? d : null;
}

/** e.g. 2026-09-13 → 13-09-2026 */
export function formatDisplayDate(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  if (value == null || value === "") return fallback;
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = toDate(value);
  return d ? format(d, "dd-MM-yyyy") : fallback;
}

/** e.g. ISO timestamp → 13-09-2026 16:45 */
export function formatDisplayDateTime(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  const d = toDate(value);
  return d ? format(d, "dd-MM-yyyy HH:mm") : fallback;
}

/** Date + optional time for booking slots */
export function formatDisplaySlot(
  date: string | Date | null | undefined,
  time?: string | null,
  fallback = "—",
): string {
  const d = formatDisplayDate(date, "");
  if (!d) return fallback;
  const t = (time || "").toString().trim().slice(0, 8);
  return t ? `${d} · ${t}` : d;
}
