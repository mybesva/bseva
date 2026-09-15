import type { ServiceAvailabilityStatus } from "@/lib/ServiceAvailabilityContext";

const STORAGE_KEY = "bseva_service_availability_v1";

export type StoredAvailability = {
  userId: string;
  status: ServiceAvailabilityStatus;
  checkedAt: number;
  /** Coords used for this result — invalidate when My Address pin changes. */
  locationKey: string;
};

export function locationKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export function isBrowserReload(): boolean {
  if (typeof performance === "undefined") return true;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "reload";
}

const VALID: ServiceAvailabilityStatus[] = [
  "available",
  "unavailable",
  "no_address",
  "permission_denied",
  "unsupported",
  "error",
];

export function readStoredAvailability(userId: string | null): StoredAvailability | null {
  if (!userId || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAvailability;
    if (parsed.userId !== userId) return null;
    if (!VALID.includes(parsed.status)) return null;
    if (!parsed.locationKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredAvailability(data: StoredAvailability): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

export function clearStoredAvailability(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
