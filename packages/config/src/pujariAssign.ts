/** Search and sort the pujaris an admin can assign to a booking (web dialog and admin app share this). */

export type AssignablePujari = {
  id: string;
  name?: string | null;
  phone?: string | null;
  approved_level?: number | null;
  experience_years?: number | null;
  specializations?: unknown;
  location_label?: string | null;
  city?: string | null;
  district?: string | null;
  distance_km?: number | null;
  schedule_conflict?: boolean;
};

export type AssignSort = "nearest" | "experience" | "name";

export const ASSIGN_SORT_OPTIONS: { value: AssignSort; label: string }[] = [
  { value: "nearest", label: "Nearest first" },
  { value: "experience", label: "Most experience" },
  { value: "name", label: "Name (A–Z)" },
];

function specializationText(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join(" ");
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(String).join(" ");
    } catch {
      /* plain comma-separated text */
    }
    return v;
  }
  return "";
}

/** True when every word of the query appears in the pujari's name, phone, area, or pujas they perform. */
export function pujariMatchesQuery(p: AssignablePujari, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const digits = query.replace(/\D/g, "");
  const haystack = [p.name, p.city, p.district, p.location_label, specializationText(p.specializations)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const phone = String(p.phone || "").replace(/\D/g, "");
  if (digits.length >= 4 && phone.includes(digits)) return true;
  return words.every((w) => haystack.includes(w));
}

/** Distance from the pujari to the puja location: "210 m away", "9.3 km away", "15 km away", "Distance unknown". */
export function formatPujariDistance(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return "Distance unknown";
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m away`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

function byDistance(a: AssignablePujari, b: AssignablePujari): number {
  const da = a.distance_km ?? Number.POSITIVE_INFINITY;
  const db = b.distance_km ?? Number.POSITIVE_INFINITY;
  if (da !== db) return da - db;
  return (b.approved_level ?? 0) - (a.approved_level ?? 0) || String(a.name || "").localeCompare(String(b.name || ""));
}

/** Filter by the search text, then sort. Pujaris with no known distance always go after those with one. */
export function searchAndSortPujaris<T extends AssignablePujari>(list: T[], query: string, sort: AssignSort = "nearest"): T[] {
  const out = list.filter((p) => pujariMatchesQuery(p, query));
  if (sort === "experience") {
    return out.sort((a, b) => (b.experience_years ?? -1) - (a.experience_years ?? -1) || byDistance(a, b));
  }
  if (sort === "name") {
    return out.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
  }
  return out.sort(byDistance);
}
