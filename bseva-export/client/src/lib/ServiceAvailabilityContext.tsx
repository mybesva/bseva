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
  /** Soft refresh skips if a recent successful check exists; force bypasses TTL. */
  refresh: (opts?: { force?: boolean }) => Promise<void>;
};

const MOVE_THRESHOLD_KM = 0.5;
/** Reuse a recent result instead of spinning GPS again (10 KM radius does not need meter precision). */
const CHECK_TTL_MS = 90_000;
/**
 * Network/wifi location is enough for a 10 KM service radius.
 * High-accuracy GPS often takes 5–15s and was the main UI delay.
 */
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 60_000,
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
  const lastStatusRef = useRef<ServiceAvailabilityStatus>("idle");
  const watchIdRef = useRef<number | null>(null);
  const checkSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const isCustomer = Boolean(isAuthenticated && user?.role === "customer");

  useEffect(() => {
    lastStatusRef.current = status;
  }, [status]);

  const runCheck = useCallback(
    async (opts?: { coords?: { lat: number; lng: number }; force?: boolean }) => {
      if (!isCustomer) {
        setStatus("idle");
        return;
      }
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setStatus("unsupported");
        return;
      }

      const now = Date.now();
      if (
        !opts?.force &&
        !opts?.coords &&
        lastCheckedAt != null &&
        now - lastCheckedAt < CHECK_TTL_MS &&
        (lastStatusRef.current === "available" || lastStatusRef.current === "unavailable")
      ) {
        return;
      }

      if (inFlightRef.current && !opts?.force) return;

      const seq = ++checkSeqRef.current;
      inFlightRef.current = true;
      setStatus("checking");

      try {
        let lat: number;
        let lng: number;
        if (opts?.coords) {
          lat = opts.coords.lat;
          lng = opts.coords.lng;
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
      } finally {
        if (seq === checkSeqRef.current) inFlightRef.current = false;
      }
    },
    [isCustomer, lastCheckedAt]
  );

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      await runCheck({ force: opts?.force === true });
    },
    [runCheck]
  );

  // Start as soon as customer session is ready (covers login → dashboard).
  useEffect(() => {
    if (authLoading) return;
    if (!isCustomer) {
      setStatus("idle");
      setLastCheckedAt(null);
      lastCoordsRef.current = null;
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    void runCheck({ force: true });
  }, [authLoading, isCustomer]); // eslint-disable-line react-hooks/exhaustive-deps -- only on session change

  // Soft re-check when returning to the tab (skip if recent).
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
        if (!prev || haversineKm(prev.lat, prev.lng, lat, lng) >= MOVE_THRESHOLD_KM) {
          void runCheck({ coords: { lat, lng }, force: true });
        }
      },
      () => {
        /* permission / watch errors handled by explicit refresh */
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60_000 }
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
