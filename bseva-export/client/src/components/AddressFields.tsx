import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

export type AddressValue = {
  address_line1: string;
  address_line2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
  location_label: string;
  latitude: number | null;
  longitude: number | null;
};

type Props = {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  className?: string;
};

const MAPS_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  (import.meta.env.VITE_FRONTEND_FORGE_API_KEY as string | undefined);
const FORGE_BASE = (import.meta.env.VITE_FRONTEND_FORGE_API_URL as string | undefined) || "https://forge.butterfly-effect.dev";
const MAPS_SCRIPT = MAPS_KEY?.startsWith("AIza")
  ? `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=marker,geocoding&v=weekly`
  : `${FORGE_BASE}/v1/maps/proxy/maps/api/js?key=${MAPS_KEY}&libraries=marker,geocoding&v=weekly`;

function loadMaps() {
  if (window.google?.maps) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    if (!MAPS_KEY) {
      reject(new Error("Maps API key not configured"));
      return;
    }
    const existing = document.querySelector('script[data-bseva-maps="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = MAPS_SCRIPT;
    script.async = true;
    script.dataset.bsevaMaps = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load maps"));
    document.head.appendChild(script);
  });
}

function LocationPicker({ value, onChange }: { value: AddressValue; onChange: (v: AddressValue) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [search, setSearch] = useState(value.location_label || "");
  const [mapError, setMapError] = useState<string | null>(null);

  function applyCoords(lat: number, lng: number, label?: string) {
    onChange({ ...value, latitude: lat, longitude: lng, location_label: label || value.location_label });
    if (mapObj.current) {
      mapObj.current.setCenter({ lat, lng });
      if (markerRef.current) markerRef.current.position = { lat, lng };
    }
  }

  async function reverseGeocode(lat: number, lng: number) {
    if (!window.google?.maps) return;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== "OK" || !results?.[0]) return;
      const comp = results[0].address_components || [];
      const pick = (type: string) => comp.find((c) => c.types.includes(type))?.long_name || "";
      onChange({
        ...value,
        latitude: lat,
        longitude: lng,
        location_label: results[0].formatted_address || value.location_label,
        address_line1: value.address_line1 || `${pick("street_number")} ${pick("route")}`.trim(),
        city: value.city || pick("locality") || pick("administrative_area_level_2"),
        district: value.district || pick("administrative_area_level_2"),
        state: value.state || pick("administrative_area_level_1"),
        pincode: value.pincode || pick("postal_code"),
        country: value.country || pick("country") || "India",
      });
      setSearch(results[0].formatted_address || "");
    });
  }

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const center = { lat: value.latitude ?? 12.9716, lng: value.longitude ?? 77.5946 };
        mapObj.current = new google.maps.Map(mapRef.current, { center, zoom: value.latitude ? 15 : 11, mapId: "BSEVA_MAP" });
        markerRef.current = new google.maps.marker.AdvancedMarkerElement({ map: mapObj.current, position: center, gmpDraggable: true });
        markerRef.current.addListener("dragend", () => {
          const pos = markerRef.current?.position as google.maps.LatLngLiteral | undefined;
          if (pos) void reverseGeocode(Number(pos.lat), Number(pos.lng));
        });
        mapObj.current.addListener("click", (e: google.maps.MapMouseEvent) => {
          const lat = e.latLng?.lat();
          const lng = e.latLng?.lng();
          if (lat == null || lng == null) return;
          applyCoords(lat, lng);
          void reverseGeocode(lat, lng);
        });
      })
      .catch((e) => setMapError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  function geocodeSearch() {
    if (!window.google?.maps || !search.trim()) return;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: search }, (results, status) => {
      if (status !== "OK" || !results?.[0]?.geometry?.location) {
        setMapError("Location not found");
        return;
      }
      const lat = results[0].geometry.location.lat();
      const lng = results[0].geometry.location.lng();
      applyCoords(lat, lng, results[0].formatted_address);
      void reverseGeocode(lat, lng);
    });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMapError("Geolocation is not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyCoords(pos.coords.latitude, pos.coords.longitude);
        void reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      },
      () => setMapError("Could not access current location")
    );
  }

  return (
    <div className="space-y-3">
      <Label>Location on map</Label>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search address or place" />
        <Button type="button" variant="secondary" onClick={geocodeSearch}>Search</Button>
        <Button type="button" variant="outline" onClick={useCurrentLocation} className="gap-1">
          <Navigation size={16} /> Current location
        </Button>
      </div>
      {mapError && <p className="text-sm text-destructive">{mapError}</p>}
      {!MAPS_KEY && (
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <MapPin size={14} /> Set VITE_GOOGLE_MAPS_API_KEY for interactive maps. Enter coordinates manually below.
        </p>
      )}
      <div ref={mapRef} className={cn("w-full h-64 rounded-md border bg-muted", !MAPS_KEY && "hidden")} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Latitude</Label>
          <Input type="number" step="any" value={value.latitude ?? ""} onChange={(e) => onChange({ ...value, latitude: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div>
          <Label>Longitude</Label>
          <Input type="number" step="any" value={value.longitude ?? ""} onChange={(e) => onChange({ ...value, longitude: e.target.value ? Number(e.target.value) : null })} />
        </div>
      </div>
    </div>
  );
}

export default function AddressFields({ value, onChange, className }: Props) {
  function set<K extends keyof AddressValue>(key: K, v: AddressValue[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label>Address line 1 / House or flat number *</Label>
          <Input value={value.address_line1} onChange={(e) => set("address_line1", e.target.value)} required />
        </div>
        <div className="md:col-span-2">
          <Label>Address line 2 / Street / Locality</Label>
          <Input value={value.address_line2} onChange={(e) => set("address_line2", e.target.value)} />
        </div>
        <div>
          <Label>City / Village *</Label>
          <Input value={value.city} onChange={(e) => set("city", e.target.value)} required />
        </div>
        <div>
          <Label>District *</Label>
          <Input value={value.district} onChange={(e) => set("district", e.target.value)} required />
        </div>
        <div>
          <Label>State *</Label>
          <Input value={value.state} onChange={(e) => set("state", e.target.value)} required />
        </div>
        <div>
          <Label>PIN code *</Label>
          <Input value={value.pincode} onChange={(e) => set("pincode", e.target.value)} required />
        </div>
        <div>
          <Label>Country</Label>
          <Input value={value.country || "India"} onChange={(e) => set("country", e.target.value)} />
        </div>
        <div>
          <Label>Location label</Label>
          <Input value={value.location_label} onChange={(e) => set("location_label", e.target.value)} placeholder="e.g. Koramangala, Bengaluru" />
        </div>
      </div>
      <LocationPicker value={value} onChange={onChange} />
    </div>
  );
}

declare global {
  interface Window {
    google?: typeof google;
  }
}
