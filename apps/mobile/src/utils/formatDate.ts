/** Display dates as DD-MM-YYYY. Keep API payloads as yyyy-MM-dd. */

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
