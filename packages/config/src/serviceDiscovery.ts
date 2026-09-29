/**
 * Customer discovery helpers shared by web and mobile.
 *
 * Explore Services shows three Seva lines (Puja, Chadhava, Pravachan). Puja discovery keeps the
 * original `GET /services?q=&category=` catalogue rules; that endpoint can also return Chadhava and
 * Pravachan rows, so every Puja surface filters by `service_type` here.
 */

export const SEVA_SERVICE_TYPES = ["puja", "chadhava", "pravachan"] as const;
export type SevaServiceType = (typeof SEVA_SERVICE_TYPES)[number];

export const DEFAULT_SEVA_SERVICE_TYPE: SevaServiceType = "puja";

export type SevaConfigFlags = {
  seva_events_enabled?: boolean | null;
  chadhava_enabled?: boolean | null;
  pravachan_enabled?: boolean | null;
};

type WithServiceType = { service_type?: string | null };
type WithBookable = { bookable?: boolean | null };

export function isSevaServiceType(value: unknown): value is SevaServiceType {
  return typeof value === "string" && (SEVA_SERVICE_TYPES as readonly string[]).includes(value);
}

/** Rows written before `service_type` existed are Puja rows. */
export function isPujaService(row: WithServiceType): boolean {
  const type = row.service_type;
  return type === undefined || type === null || type === "" || type === "puja";
}

/** Keep only Puja rows so Chadhava / Pravachan never leak into the Puja grid. */
export function pujaServicesOnly<T extends WithServiceType>(rows: readonly T[] | null | undefined): T[] {
  return (rows || []).filter(isPujaService);
}

/** Keep only rows of a single non-Puja Seva line. */
export function servicesOfType<T extends WithServiceType>(
  rows: readonly T[] | null | undefined,
  type: SevaServiceType
): T[] {
  if (type === "puja") return pujaServicesOnly(rows);
  return (rows || []).filter((row) => row.service_type === type);
}

/**
 * Tabs visible to customers. Puja is always available (it is the Explore catalogue). Chadhava and
 * Pravachan need both the Seva master switch and their own switch, matching the backend gates.
 * Missing flags count as enabled (same default as the backend).
 */
export function enabledSevaServiceTypes(config?: SevaConfigFlags | null): SevaServiceType[] {
  const sevaOn = config?.seva_events_enabled !== false;
  const out: SevaServiceType[] = ["puja"];
  if (sevaOn && config?.chadhava_enabled !== false) out.push("chadhava");
  if (sevaOn && config?.pravachan_enabled !== false) out.push("pravachan");
  return out;
}

/** Resolve a `?type=` / legacy `/seva/:serviceType` value to a usable tab (defaults to Puja). */
export function resolveSevaServiceType(
  raw: string | null | undefined,
  enabled: readonly SevaServiceType[] = SEVA_SERVICE_TYPES
): SevaServiceType {
  const value = (raw || "").trim().toLowerCase();
  if (isSevaServiceType(value) && enabled.includes(value)) return value;
  return DEFAULT_SEVA_SERVICE_TYPE;
}

/** Explore Services URL for a tab. Puja keeps the original `/services` URL. */
export function servicesPathForType(type: SevaServiceType): string {
  return type === "puja" ? "/services" : `/services?type=${type}`;
}

/** `?q=&category=` string for the Puja pane (`type` is only written for non-Puja tabs). */
export function buildServicesSearch(params: {
  type?: SevaServiceType;
  q?: string | null;
  category?: string | null;
}): string {
  const next = new URLSearchParams();
  if (params.type && params.type !== "puja") next.set("type", params.type);
  const q = (params.q || "").trim();
  if (q) next.set("q", q);
  if (params.category && params.category !== "all") next.set("category", params.category);
  const search = next.toString();
  return search ? `?${search}` : "";
}

/** Query passed to `GET /services` (server-side search + category + popular filtering). */
export function buildServicesApiQuery(params: {
  q?: string | null;
  category?: string | null;
}): Record<string, string> {
  const out: Record<string, string> = {};
  const q = (params.q || "").trim();
  if (q) out.q = q;
  if (params.category && params.category !== "all") out.category = params.category;
  return out;
}

/** Bookable first, then upcoming / coming soon (original Explore ordering). */
export function splitAvailableUpcoming<T extends WithBookable>(
  rows: readonly T[]
): { available: T[]; upcoming: T[]; combined: T[] } {
  const available = rows.filter((row) => Boolean(row.bookable));
  const upcoming = rows.filter((row) => !row.bookable);
  return { available, upcoming, combined: [...available, ...upcoming] };
}
