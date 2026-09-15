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
  readStoredAvailability,
  writeStoredAvailability,
} from "@/lib/serviceAvailabilityStorage";

export type ServiceAvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "unavailable"
  | "permission_denied"
  | "unsupported"
  | "error";

type ServiceAvailabilityState = {
  status: ServiceAvailabilityStatus;
  serviceAvailable: boolean;
  canBook: boolean;
  checking: boolean;
  lastCheckedAt: number | null;
  /** Manual retry only (permission denied / error banners). */
  refresh: () => Promise<void>;
};

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 60_000,
};

const ServiceAvailabilityContext = createContext<ServiceAvailabilityState | null>(null);

function mapGeoError(err: GeolocationPositionError): ServiceAvailabilityStatus {
  if (err.code === err.PERMISSION_DENIED) return "permission_denied";
  return "error";
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS);
  });
}

export function ServiceAvailabilityProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const isCustomer = Boolean(isAuthenticated && user?.role === "customer");
  const customerId = isCustomer ? String(user!.id) : null;

  const [status, setStatus] = useState<ServiceAvailabilityStatus>("idle");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const checkSeqRef = useRef(0);
  /** In-memory guard: one automatic check per login until logout or F5. */
  const resolvedSessionRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const persist = useCallback((userId: string, next: ServiceAvailabilityStatus) => {
    const at = Date.now();
    setLastCheckedAt(at);
    writeStoredAvailability({ userId, status: next, checkedAt: at });
    resolvedSessionRef.current = userId;
  }, []);

  const runCheck = useCallback(
    async (userId: string) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setStatus("unsupported");
        persist(userId, "unsupported");
        return;
      }

      if (inFlightRef.current) return;

      const seq = ++checkSeqRef.current;
      inFlightRef.current = true;
      setStatus("checking");

      try {
        const pos = await getCurrentPosition();
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const result = await api<{ service_available: boolean }>(
          `/service-availability?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`
        );

        if (seq !== checkSeqRef.current) return;

        const next: ServiceAvailabilityStatus = result.service_available ? "available" : "unavailable";
        setStatus(next);
        persist(userId, next);
      } catch (e: unknown) {
        if (seq !== checkSeqRef.current) return;
        const next =
          e && typeof e === "object" && "code" in e
            ? mapGeoError(e as GeolocationPositionError)
            : "error";
        setStatus(next);
        persist(userId, next);
      } finally {
        if (seq === checkSeqRef.current) inFlightRef.current = false;
      }
    },
    [persist]
  );

  const refresh = useCallback(async () => {
    if (!customerId) return;
    resolvedSessionRef.current = null;
    await runCheck(customerId);
  }, [customerId, runCheck]);

  // Automatic check: once after login, or again only on full browser refresh (F5).
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

    const reload = isBrowserReload();

    if (!reload) {
      const cached = readStoredAvailability(customerId);
      if (cached) {
        setStatus(cached.status);
        setLastCheckedAt(cached.checkedAt);
        resolvedSessionRef.current = customerId;
        return;
      }
    }

    void runCheck(customerId);
  }, [authLoading, isCustomer, customerId, runCheck]);

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
