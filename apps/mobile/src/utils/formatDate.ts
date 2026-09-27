/** Display dates as DD-MM-YYYY. Keep API payloads as yyyy-MM-dd. */

export function parseDisplayDateToIso(input: string): string | null {
  const m = input.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Human-readable date for filter fields, e.g. 30 Sep 2026. API values stay yyyy-MM-dd. */
export function formatHumanDate(value: string | null | undefined, fallback = ""): string {
  if (!value) return fallback;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return fallback;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDisplayDate(value: string | Date | null | undefined, fallback = "—"): string {
  if (value == null || value === "") return fallback;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const dd = String(value.getDate()).padStart(2, "0");
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const yyyy = value.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return fallback;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function formatDisplaySlot(
  date: string | Date | null | undefined,
  time?: string | null,
  fallback = "—",
): string {
  const d = formatDisplayDate(date, "");
  if (!d) return fallback;
  const t = (time || "").toString().trim().slice(0, 8);
  return t ? `${d} ${t}` : d;
}
