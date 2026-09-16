import { INTL_LOCALES, normalizeLang, type Lang } from "./constants";

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatCurrencyPaise(paise: number | null | undefined, lang: Lang | string = "en"): string {
  const n = Number(paise || 0) / 100;
  try {
    return new Intl.NumberFormat(INTL_LOCALES[normalizeLang(lang)], {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  } catch {
    return `₹${n.toLocaleString("en-IN")}`;
  }
}

export function formatNumber(value: number, lang: Lang | string = "en"): string {
  try {
    return new Intl.NumberFormat(INTL_LOCALES[normalizeLang(lang)]).format(value);
  } catch {
    return String(value);
  }
}

/** Numeric DD-MM-YYYY remains stable across languages (identifiers/dates on invoices). */
export function formatDisplayDate(value: string | Date | null | undefined, fallback = "—"): string {
  if (value == null || value === "") return fallback;
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = toDate(value);
  if (!d) return fallback;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function formatDisplayDateTime(value: string | Date | null | undefined, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${formatDisplayDate(d)} ${hh}:${min}`;
}

/** Localized weekday + month names, numeric day/year. */
export function formatLongDate(value: string | Date | null | undefined, lang: Lang | string = "en", fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  try {
    return new Intl.DateTimeFormat(INTL_LOCALES[normalizeLang(lang)], {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return formatDisplayDate(d, fallback);
  }
}

export function formatTime(value: string | Date | null | undefined, lang: Lang | string = "en", fallback = "—"): string {
  if (value == null || value === "") return fallback;
  const s = String(value).trim();
  if (/^\d{2}:\d{2}/.test(s)) {
    const [h, m] = s.split(":");
    const d = new Date();
    d.setHours(Number(h), Number(m), 0, 0);
    try {
      return new Intl.DateTimeFormat(INTL_LOCALES[normalizeLang(lang)], {
        hour: "numeric",
        minute: "2-digit",
      }).format(d);
    } catch {
      return s.slice(0, 5);
    }
  }
  const d = toDate(value);
  if (!d) return fallback;
  try {
    return new Intl.DateTimeFormat(INTL_LOCALES[normalizeLang(lang)], {
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return formatDisplayDateTime(d, fallback);
  }
}

export function formatSlot(
  date: string | Date | null | undefined,
  time?: string | null,
  lang: Lang | string = "en",
  fallback = "—",
): string {
  const d = formatLongDate(date, lang, "");
  if (!d) return fallback;
  const t = (time || "").toString().trim();
  return t ? `${d} · ${formatTime(t, lang, t.slice(0, 5))}` : d;
}
