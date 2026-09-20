import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  clearStoredAvailability,
  isBrowserReload,
  locationKey,
  readStoredAvailability,
  writeStoredAvailability,
} from "@/lib/serviceAvailabilityStorage";

export type ServiceAvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "unavailable"
  | "no_address"
  | "permission_denied"
  | "unsupported"
  | "error";

type Coords = { lat: number; lng: number; key: string };

type ServiceAvailabilityState = {
  status: ServiceAvailabilityStatus;
  serviceAvailable: boolean;
  canBook: boolean;
  checking: boolean;
  lastCheckedAt: number | null;
  /** Re-check using My Address, or explicit coords after save / new booking address. */
  refresh: (opts?: { lat?: number; lng?: number }) => Promise<void>;
};

const ServiceAvailabilityContext = createContext<ServiceAvailabilityState | null>(null);

async function fetchProfileCoords(): Promise<Coords | null> {
  const p = await api<{
    latitude?: number | null;
    longitude?: number | null;
  }>("/customer/profile");
  if (p.latitude == null || p.longitude == null) return null;
  const lat = Number(p.latitude);
  const lng = Number(p.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, key: locationKey(lat, lng) };
}

export function ServiceAvailabilityProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const isCustomer = Boolean(isAuthenticated && user?.role === "customer");
  const customerId = isCustomer ? String(user!.id) : null;

  const [status, setStatus] = useState<ServiceAvailabilityStatus>("idle");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const checkSeqRef = useRef(0);
  const resolvedSessionRef = useRef<string | null>(null);

  const persist = useCallback((userId: string, next: ServiceAvailabilityStatus, key: string) => {
    const at = Date.now();
    setLastCheckedAt(at);
    writeStoredAvailability({ userId, status: next, checkedAt: at, locationKey: key });
    resolvedSessionRef.current = userId;
  }, []);

  const runCheckAt = useCallback(
    async (userId: string, coords: Coords, opts?: { silent?: boolean }) => {
      const seq = ++checkSeqRef.current;
      if (!opts?.silent) setStatus("checking");

      try {
        const result = await api<{ service_available: boolean }>(
          `/service-availability?lat=${encodeURIComponent(String(coords.lat))}&lng=${encodeURIComponent(String(coords.lng))}`
        );

        if (seq !== checkSeqRef.current) return;

        const next: ServiceAvailabilityStatus = result.service_available ? "available" : "unavailable";
        setStatus(next);
        persist(userId, next, coords.key);
      } catch {
        if (seq !== checkSeqRef.current) return;
        setStatus("error");
        persist(userId, "error", coords.key);
      }
    },
    [persist]
  );

  const refresh = useCallback(
    async (opts?: { lat?: number; lng?: number }) => {
      if (!customerId) return;
      resolvedSessionRef.current = null;

      let coords: Coords | null = null;
      if (opts?.lat != null && opts?.lng != null) {
        coords = { lat: opts.lat, lng: opts.lng, key: locationKey(opts.lat, opts.lng) };
      } else {
        try {
          coords = await fetchProfileCoords();
        } catch {
          setStatus("error");
          return;
        }
      }

      if (!coords) {
        setStatus("no_address");
        setLastCheckedAt(Date.now());
        clearStoredAvailability();
        resolvedSessionRef.current = customerId;
        return;
      }

      await runCheckAt(customerId, coords);
    },
    [customerId, runCheckAt]
  );

  // Once after login, or on F5 — uses logged-in customer's My Address pin only (not device GPS).
  useEffect(() => {
    if (authLoading) return;

    if (!isCustomer || !customerId) {
      setStatus("idle");
      setLastCheckedAt(null);
      resolvedSessionRef.current = null;
      clearStoredAvailability();
      return;
    }

    if (resolvedSessionRef.current === customerId) return;

    let cancelled = false;

    void (async () => {
      let coords: Coords | null = null;
      try {
        coords = await fetchProfileCoords();
      } catch {
        if (!cancelled) setStatus("error");
        return;
      }
      if (cancelled) return;

      if (!coords) {
        setStatus("no_address");
        setLastCheckedAt(Date.now());
        resolvedSessionRef.current = customerId;
        return;
      }

      const reload = isBrowserReload();
      const cached = !reload ? readStoredAvailability(customerId) : null;
      if (cached && cached.locationKey === coords.key) {
        setStatus(cached.status);
        setLastCheckedAt(cached.checkedAt);
        resolvedSessionRef.current = customerId;
        return;
      }

      await runCheckAt(customerId, coords);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isCustomer, customerId, runCheckAt]);

  const value = useMemo<ServiceAvailabilityState>(() => {
    const checking = status === "checking";
    const canBook = status === "available";
    return {
      status,
      serviceAvailable: canBook,
      canBook,
      checking,
      lastCheckedAt,
      refresh,
    };
  }, [status, lastCheckedAt, refresh]);

  return (
    <ServiceAvailabilityContext.Provider value={value}>{children}</ServiceAvailabilityContext.Provider>
  );
}

export function useServiceAvailability(): ServiceAvailabilityState {
  const ctx = useContext(ServiceAvailabilityContext);
  if (!ctx) {
    return {
      status: "idle",
      serviceAvailable: false,
      canBook: false,
      checking: false,
      lastCheckedAt: null,
      refresh: async () => undefined,
    };
  }
  return ctx;
}
