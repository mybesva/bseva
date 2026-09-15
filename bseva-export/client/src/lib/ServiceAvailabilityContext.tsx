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
import { haversineKm } from "@/lib/haversine";

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
  /** True only when we confirmed at least one eligible pujari within radius. */
  canBook: boolean;
  checking: boolean;
  lastCheckedAt: number | null;
  refresh: () => Promise<void>;
};

const MOVE_THRESHOLD_KM = 0.5;
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

const ServiceAvailabilityContext = createContext<ServiceAvailabilityState | null>(null);

function mapGeoError(err: GeolocationPositionError): ServiceAvailabilityStatus {
  if (err.code === err.PERMISSION_DENIED) return "permission_denied";
  if (err.code === err.POSITION_UNAVAILABLE || err.code === err.TIMEOUT) return "error";
  return "error";
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS);
  });
}

export function ServiceAvailabilityProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<ServiceAvailabilityStatus>("idle");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const checkSeqRef = useRef(0);
  const isCustomer = Boolean(isAuthenticated && user?.role === "customer");

  const runCheck = useCallback(async (coords?: { lat: number; lng: number }) => {
    if (!isCustomer) {
      setStatus("idle");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    const seq = ++checkSeqRef.current;
    setStatus("checking");

    try {
      let lat: number;
      let lng: number;
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      } else {
        const pos = await getCurrentPosition();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }

      const result = await api<{ service_available: boolean }>(
        `/service-availability?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`
      );

      if (seq !== checkSeqRef.current) return;

      lastCoordsRef.current = { lat, lng };
      setLastCheckedAt(Date.now());
      setStatus(result.service_available ? "available" : "unavailable");
    } catch (e: unknown) {
      if (seq !== checkSeqRef.current) return;
      if (e && typeof e === "object" && "code" in e) {
        setStatus(mapGeoError(e as GeolocationPositionError));
        return;
      }
      setStatus("error");
    }
  }, [isCustomer]);

  const refresh = useCallback(async () => {
    await runCheck();
  }, [runCheck]);

  // Fresh check on login / when customer session is ready, and whenever dashboard remounts via provider.
  useEffect(() => {
    if (authLoading) return;
    if (!isCustomer) {
      setStatus("idle");
      lastCoordsRef.current = null;
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    void runCheck();
  }, [authLoading, isCustomer, runCheck]);

  // Re-check when returning to the tab / page visibility.
  useEffect(() => {
    if (!isCustomer) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void runCheck();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isCustomer, runCheck]);

  // Significant location change while app is open.
  useEffect(() => {
    if (!isCustomer || !navigator.geolocation) return;
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const prev = lastCoordsRef.current;
        if (
          !prev ||
          haversineKm(prev.lat, prev.lng, lat, lng) >= MOVE_THRESHOLD_KM
        ) {
          void runCheck({ lat, lng });
        }
      },
      () => {
        /* permission / watch errors handled by explicit refresh */
      },
      { ...GEO_OPTIONS, maximumAge: 30_000 }
    );
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isCustomer, runCheck]);

  const value = useMemo<ServiceAvailabilityState>(() => {
    const checking = status === "checking" || (isCustomer && status === "idle");
    const canBook = status === "available";
    return {
      status,
      serviceAvailable: canBook,
      canBook,
      checking,
      lastCheckedAt,
      refresh,
    };
  }, [status, isCustomer, lastCheckedAt, refresh]);

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
