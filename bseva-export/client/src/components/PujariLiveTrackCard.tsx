import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Loader2, MapPin, Navigation, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDisplayDateTime } from "@/lib/formatDate";

type Ping = {
  available?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  recorded_at?: string | null;
  message?: string | null;
  window_minutes?: number;
};

type Props = {
  bookingId: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  className?: string;
  /** Poll interval ms while tracking is available (0 = off). Default 30s. */
  pollMs?: number;
};

function mapsEmbedUrl(lat: number, lng: number) {
  const key = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();
  if (key) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${lat},${lng}&zoom=15`;
  }
  const delta = 0.012;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function mapsExternalUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export default function PujariLiveTrackCard({
  bookingId,
  destinationLat,
  destinationLng,
  className,
  pollMs = 30000,
}: Props) {
  const [ping, setPing] = useState<Ping | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setRefreshing(true);
      try {
        const row = await api<Ping | null>(`/bookings/${bookingId}/location`);
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
    if (!pollMs || pollMs < 5000) return;
    if (ping?.available === false) return;
    const t = window.setInterval(() => void load({ silent: true }), pollMs);
    return () => window.clearInterval(t);
  }, [load, pollMs, ping?.available]);

  const lat = ping?.latitude != null ? Number(ping.latitude) : null;
  const lng = ping?.longitude != null ? Number(ping.longitude) : null;
  const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  if (loading) {
    return (
      <div className={cn("rounded-lg border border-border bg-muted/20 p-4 flex items-center gap-2 text-sm", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Checking live tracking…
      </div>
    );
  }

  if (ping?.available === false) {
    return (
      <div className={cn("rounded-lg border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground", className)}>
        <p className="font-medium text-foreground flex items-center gap-2 mb-1">
          <Navigation size={16} className="text-primary" />
          Live pujari tracking
        </p>
        <p>{ping.message || "Pujari tracking opens 15 minutes before start."}</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground flex items-center gap-2">
            <Navigation size={16} className="text-primary" />
            Track pujari live
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasCoords
              ? `Last updated ${ping?.recorded_at ? formatDisplayDateTime(ping.recorded_at) : "just now"}`
              : "Waiting for the pujari to share their location…"}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={() => void load()}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Refresh Location
        </Button>
      </div>

      {hasCoords ? (
        <>
          <div className="overflow-hidden rounded-md border border-border bg-background">
            <iframe
              title="Pujari live location"
              src={mapsEmbedUrl(lat!, lng!)}
              className="w-full h-56 md:h-72 border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {lat!.toFixed(5)}, {lng!.toFixed(5)}
            </span>
            <Button asChild size="sm" variant="secondary">
              <a href={mapsExternalUrl(lat!, lng!)} target="_blank" rel="noopener noreferrer">
                Open in Maps
              </a>
            </Button>
            {destinationLat != null && destinationLng != null && (
              <Button asChild size="sm" variant="ghost">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${destinationLat},${destinationLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Directions to puja
                </a>
              </Button>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Tracking is open. Waiting for the pujari&apos;s live location…
        </p>
      )}
    </div>
  );
}
