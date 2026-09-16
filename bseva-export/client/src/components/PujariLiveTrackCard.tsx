import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Loader2, Navigation, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDisplayDateTime } from "@/lib/formatDate";
import { haversineMeters, loadGoogleMaps, mapsDirectionsUrl, mapsSearchUrl } from "@/lib/googleMaps";
import { useI18n } from "@/i18n/I18nProvider";

export type LocationPing = {
  available?: boolean;
  tracking_active?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  recorded_at?: string | null;
  message?: string | null;
  window_minutes?: number;
  poll_interval_seconds?: number;
  distance_m?: number | null;
  destination_latitude?: number | null;
  destination_longitude?: number | null;
  arrived?: boolean;
  stop_reason?: string | null;
  stale?: boolean;
};

type Props = {
  bookingId: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  className?: string;
  pollMs?: number;
};

const ROUTE_MOVE_METERS = 120;
const ROUTE_MAX_AGE_MS = 180_000;

export default function PujariLiveTrackCard({
  bookingId,
  destinationLat,
  destinationLng,
  className,
  pollMs,
}: Props) {
  const { t } = useI18n();
  const [ping, setPing] = useState<LocationPing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [etaText, setEtaText] = useState<string | null>(null);
  const [distText, setDistText] = useState<string | null>(null);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pujariMarker = useRef<google.maps.Marker | null>(null);
  const destMarker = useRef<google.maps.Marker | null>(null);
  const renderer = useRef<google.maps.DirectionsRenderer | null>(null);
  const lastRouteOrigin = useRef<{ lat: number; lng: number; at: number } | null>(null);

  const destLat = ping?.destination_latitude ?? destinationLat ?? null;
  const destLng = ping?.destination_longitude ?? destinationLng ?? null;
  const intervalMs = pollMs ?? Math.max(15_000, (ping?.poll_interval_seconds || 60) * 1000);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setRefreshing(true);
      try {
        const row = await api<LocationPing | null>(`/bookings/${bookingId}/location`);
        setPing(row && typeof row === "object" ? row : { available: false, message: "No location yet" });
      } catch (e: any) {
        if (!opts?.silent) toast.error(e.message || "Could not load pujari location");
        setPing({ available: false, message: e.message || "Could not load location" });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [bookingId],
  );

  useEffect(() => {
    void load({ silent: true });
  }, [load]);

  useEffect(() => {
    if (intervalMs < 5000) return;
    if (ping?.tracking_active === false && ping?.available === false) return;
    const t = window.setInterval(() => void load({ silent: true }), intervalMs);
    return () => window.clearInterval(t);
  }, [load, intervalMs, ping?.tracking_active, ping?.available]);

  const lat = ping?.latitude != null ? Number(ping.latitude) : null;
  const lng = ping?.longitude != null ? Number(ping.longitude) : null;
  const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const trackingOn = ping?.tracking_active !== false && ping?.available !== false;

  useEffect(() => {
    if (!hasCoords || !mapEl.current) return;
    let cancelled = false;
    void (async () => {
      try {
        await loadGoogleMaps();
      } catch {
        return;
      }
      if (cancelled || !mapEl.current || !window.google?.maps) return;
      const origin = { lat: lat!, lng: lng! };
      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(mapEl.current, {
          center: origin,
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
      } else {
        mapRef.current.setCenter(origin);
      }
      if (!pujariMarker.current) {
        pujariMarker.current = new google.maps.Marker({
          map: mapRef.current,
          position: origin,
          title: "Pujari",
          label: { text: "P", color: "white", fontWeight: "700" },
        });
      } else {
        pujariMarker.current.setPosition(origin);
      }
      if (destLat != null && destLng != null) {
        const dest = { lat: Number(destLat), lng: Number(destLng) };
        if (!destMarker.current) {
          destMarker.current = new google.maps.Marker({
            map: mapRef.current,
            position: dest,
            title: "Puja location",
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#1A2B4A",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
            },
          });
        } else {
          destMarker.current.setPosition(dest);
        }
        const prev = lastRouteOrigin.current;
        const moved = !prev || haversineMeters(prev, origin) >= ROUTE_MOVE_METERS;
        const stale = !prev || Date.now() - prev.at >= ROUTE_MAX_AGE_MS;
        if (moved || stale) {
          if (!renderer.current) {
            renderer.current = new google.maps.DirectionsRenderer({
              map: mapRef.current,
              suppressMarkers: true,
              polylineOptions: { strokeColor: "#E87722", strokeWeight: 5, strokeOpacity: 0.9 },
            });
          }
          const svc = new google.maps.DirectionsService();
          svc.route(
            { origin, destination: dest, travelMode: google.maps.TravelMode.DRIVING },
            (res, status) => {
              if (status === google.maps.DirectionsStatus.OK && res) {
                renderer.current?.setDirections(res);
                const leg = res.routes[0]?.legs[0];
                setDistText(leg?.distance?.text || null);
                setEtaText(leg?.duration?.text || null);
                lastRouteOrigin.current = { ...origin, at: Date.now() };
              }
            },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasCoords, lat, lng, destLat, destLng]);

  if (loading) {
    return (
      <div className={cn("rounded-lg border border-border bg-muted/20 p-4 flex items-center gap-2 text-sm", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Checking live tracking…
      </div>
    );
  }

  if (!trackingOn && !hasCoords) {
    return (
      <div className={cn("rounded-lg border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground", className)}>
        <p className="font-medium text-foreground flex items-center gap-2 mb-1">
          <Navigation size={16} className="text-primary" />
          {t("track.title")}
        </p>
        <p>{ping?.message || t("track.notAvailable")}</p>
      </div>
    );
  }

  const straightKm =
    ping?.distance_m != null ? `${(Number(ping.distance_m) / 1000).toFixed(1)} km` : distText;

  return (
    <div className={cn("rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-3 w-full", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground flex items-center gap-2">
            <Navigation size={16} className="text-primary" />
            {t("track.title")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasCoords
              ? `${t("track.lastUpdated")} ${ping?.recorded_at ? formatDisplayDateTime(ping.recorded_at) : t("track.justNow")}`
              : t("track.waitingPujari")}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={() => void load()}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          {t("track.refresh")}
        </Button>
      </div>

      {(etaText || straightKm) && (
        <div className="flex flex-wrap gap-3 text-sm">
          {etaText ? (
            <span className="rounded-full bg-background px-2.5 py-0.5 border border-border">
              {t("track.eta")}: <strong>{etaText}</strong>
            </span>
          ) : null}
          {straightKm ? (
            <span className="rounded-full bg-background px-2.5 py-0.5 border border-border">
              {t("track.distance")}: <strong>{straightKm}</strong>
            </span>
          ) : null}
        </div>
      )}

      {ping?.stale || ping?.message ? (
        <p className="text-xs text-muted-foreground">{ping.message || t("track.stale")}</p>
      ) : null}

      {hasCoords ? (
        <>
          <div className="relative overflow-hidden rounded-md border border-border bg-background">
            <div ref={mapEl} className="w-full h-56 md:h-72" title="Pujari live location" />
          </div>
          <div className="flex flex-wrap gap-2 text-xs items-center">
            <Button asChild size="sm" variant="secondary">
              <a href={mapsSearchUrl(lat!, lng!)} target="_blank" rel="noopener noreferrer">
                {t("track.openMaps")}
              </a>
            </Button>
            {destLat != null && destLng != null && (
              <Button asChild size="sm" variant="ghost">
                <a
                  href={mapsDirectionsUrl({ originLat: lat, originLng: lng, destLat: Number(destLat), destLng: Number(destLng) })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("track.directions")}
                </a>
              </Button>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("track.waitingPujari")}</p>
      )}
    </div>
  );
}
