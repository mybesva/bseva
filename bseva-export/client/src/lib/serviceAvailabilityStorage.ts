import type { ServiceAvailabilityStatus } from "@/lib/ServiceAvailabilityContext";

const STORAGE_KEY = "bseva_service_availability_v1";

export type StoredAvailability = {
  userId: string;
  status: ServiceAvailabilityStatus;
  checkedAt: number;
};

export function isBrowserReload(): boolean {
  if (typeof performance === "undefined") return true;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "reload";
}

export function readStoredAvailability(userId: string | null): StoredAvailability | null {
  if (!userId || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAvailability;
    if (parsed.userId !== userId) return null;
    if (
      parsed.status !== "available" &&
      parsed.status !== "unavailable" &&
      parsed.status !== "permission_denied" &&
      parsed.status !== "unsupported" &&
      parsed.status !== "error"
    ) {
      return null;
    }
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
