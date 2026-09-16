import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";

function toastError(msg: string) {
  toast.error(msg);
}

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

type PlaceSuggestion = {
  placeId: string;
  description: string;
};

const MAPS_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  (import.meta.env.VITE_FRONTEND_FORGE_API_KEY as string | undefined);
const FORGE_BASE =
  (import.meta.env.VITE_FRONTEND_FORGE_API_URL as string | undefined) ||
  "https://forge.butterfly-effect.dev";
// Include places for autocomplete suggestions. Do not require a custom Cloud Map ID.
const MAPS_SCRIPT = MAPS_KEY?.startsWith("AIza")
  ? `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places,geocoding&v=weekly`
  : `${FORGE_BASE}/v1/maps/proxy/maps/api/js?key=${MAPS_KEY}&libraries=places,geocoding&v=weekly`;

let mapsLoadPromise: Promise<void> | null = null;

function loadMaps() {
  if (typeof window !== "undefined" && window.google?.maps) {
    return Promise.resolve();
  }
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise<void>((resolve, reject) => {
    if (!MAPS_KEY) {
      mapsLoadPromise = null;
      reject(new Error("Maps API key not configured"));
      return;
    }
    const existing = document.querySelector('script[data-bseva-maps="1"]') as HTMLScriptElement | null;
    if (existing) {
      if (window.google?.maps) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => {
          mapsLoadPromise = null;
          reject(new Error("Failed to load maps"));
        },
        { once: true }
      );
      return;
    }
    const script = document.createElement("script");
    script.src = MAPS_SCRIPT;
    script.async = true;
    script.dataset.bsevaMaps = "1";
    script.onload = () => resolve();
    script.onerror = () => {
      mapsLoadPromise = null;
      reject(new Error("Failed to load Google Maps — check API key / billing / Maps JavaScript API"));
    };
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}

export function MapLocationPicker({ value, onChange }: { value: AddressValue; onChange: (v: AddressValue) => void }) {
  const { t } = useI18n();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const suggestTimer = useRef<number | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [search, setSearch] = useState(value.location_label || "");
  const [mapError, setMapError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);

  function applyCoords(lat: number, lng: number, label?: string) {
    const cur = valueRef.current;
    onChange({ ...cur, latitude: lat, longitude: lng, location_label: label || cur.location_label });
    if (mapObj.current) {
      mapObj.current.setCenter({ lat, lng });
      mapObj.current.setZoom(15);
      if (markerRef.current) markerRef.current.setPosition({ lat, lng });
    }
  }

  async function reverseGeocode(lat: number, lng: number) {
    if (!window.google?.maps) return;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== "OK" || !results?.[0]) return;
      const cur = valueRef.current;
      const comp = results[0].address_components || [];
      const pick = (type: string) => comp.find((c) => c.types.includes(type))?.long_name || "";
      onChange({
        ...cur,
        latitude: lat,
        longitude: lng,
        location_label: results[0].formatted_address || cur.location_label,
        address_line1: cur.address_line1 || `${pick("street_number")} ${pick("route")}`.trim(),
        city: cur.city || pick("locality") || pick("administrative_area_level_2"),
        district: cur.district || pick("administrative_area_level_2"),
        state: cur.state || pick("administrative_area_level_1"),
        pincode: cur.pincode || pick("postal_code"),
        country: cur.country || pick("country") || "India",
      });
      setSearch(results[0].formatted_address || "");
      setSuggestions([]);
      setSuggestOpen(false);
    });
  }

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !mapRef.current || !window.google?.maps) return;
        // Classic Map + Marker — no Cloud Console Map ID required (AdvancedMarker needs a real mapId).
        const center = { lat: value.latitude ?? 12.9716, lng: value.longitude ?? 77.5946 };
        mapObj.current = new google.maps.Map(mapRef.current, {
          center,
          zoom: value.latitude ? 15 : 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        markerRef.current = new google.maps.Marker({
          map: mapObj.current,
          position: center,
          draggable: true,
        });
        markerRef.current.addListener("dragend", () => {
          const pos = markerRef.current?.getPosition();
          if (pos) void reverseGeocode(pos.lat(), pos.lng());
        });
        mapObj.current.addListener("click", (e: google.maps.MapMouseEvent) => {
          const lat = e.latLng?.lat();
          const lng = e.latLng?.lng();
          if (lat == null || lng == null) return;
          applyCoords(lat, lng);
          void reverseGeocode(lat, lng);
        });
        autocompleteService.current = new google.maps.places.AutocompleteService();
        placesService.current = new google.maps.places.PlacesService(mapObj.current);
        setMapError(null);
      })
      .catch((e) => setMapError(e.message || t("web.address.mapLoadFailed")));
    return () => {
      cancelled = true;
      if (suggestTimer.current) window.clearTimeout(suggestTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init map once on mount
  }, []);

  function fetchSuggestions(query: string) {
    if (suggestTimer.current) window.clearTimeout(suggestTimer.current);
    const q = query.trim();
    if (!q || q.length < 2 || !autocompleteService.current) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }
    suggestTimer.current = window.setTimeout(() => {
      autocompleteService.current?.getPlacePredictions(
        {
          input: q,
          componentRestrictions: { country: ["in"] },
        },
        (preds, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !preds?.length) {
            setSuggestions([]);
            setSuggestOpen(false);
            return;
          }
          setSuggestions(
            preds.slice(0, 6).map((p) => ({
              placeId: p.place_id,
              description: p.description,
            }))
          );
          setSuggestOpen(true);
        }
      );
    }, 250);
  }

  function selectSuggestion(item: PlaceSuggestion) {
    setSearch(item.description);
    setSuggestions([]);
    setSuggestOpen(false);
    if (!placesService.current) {
      geocodeSearch(item.description);
      return;
    }
    placesService.current.getDetails(
      { placeId: item.placeId, fields: ["geometry", "formatted_address", "address_components", "name"] },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
          geocodeSearch(item.description);
          return;
        }
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const label = place.formatted_address || item.description;
        applyCoords(lat, lng, label);
        void reverseGeocode(lat, lng);
      }
    );
  }

  function geocodeSearch(override?: string) {
    const q = (override ?? search).trim();
    if (!window.google?.maps || !q) return;
    setSuggestOpen(false);
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: q, componentRestrictions: { country: "IN" } }, (results, status) => {
      if (status !== "OK" || !results?.[0]?.geometry?.location) {
        setMapError(t("web.address.locationNotFound"));
        return;
      }
      setMapError(null);
      const lat = results[0].geometry.location.lat();
      const lng = results[0].geometry.location.lng();
      applyCoords(lat, lng, results[0].formatted_address);
      void reverseGeocode(lat, lng);
    });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMapError(t("web.address.geolocationUnsupported"));
      toastError(t("web.address.geolocationUnsupported"));
      return;
    }
    setMapError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        applyCoords(lat, lng);
        void reverseGeocode(lat, lng);
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? t("web.address.permissionDenied")
            : err.code === err.POSITION_UNAVAILABLE
              ? t("web.address.currentUnavailable")
              : t("web.address.currentFailed");
        setMapError(msg);
        toastError(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <div className="space-y-3">
      <Label>{t("web.address.mapLocation")}</Label>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Input
            value={search}
            onChange={(e) => {
              const v = e.target.value;
              setSearch(v);
              fetchSuggestions(v);
            }}
            onFocus={() => {
              if (suggestions.length) setSuggestOpen(true);
            }}
            onBlur={() => {
              // Delay so suggestion click can register
              window.setTimeout(() => setSuggestOpen(false), 180);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (suggestions[0]) selectSuggestion(suggestions[0]);
                else geocodeSearch();
              }
            }}
            placeholder={t("web.address.searchPlaceholder")}
            autoComplete="off"
          />
          {suggestOpen && suggestions.length > 0 && (
            <ul className="absolute z-30 mt-1 w-full max-h-56 overflow-auto rounded-md border bg-background shadow-md">
              {suggestions.map((s) => (
                <li key={s.placeId}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(s)}
                  >
                    {s.description}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button type="button" variant="secondary" onClick={() => geocodeSearch()}>
          {t("common.search")}
        </Button>
        <Button type="button" variant="outline" onClick={useCurrentLocation} className="gap-1">
          <Navigation size={16} /> {t("web.address.currentLocation")}
        </Button>
      </div>
      {mapError && <p className="text-sm text-destructive">{mapError}</p>}
      {!MAPS_KEY && (
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <MapPin size={14} /> Set GOOGLE_MAPS_API_KEY / VITE_GOOGLE_MAPS_API_KEY in the repo root `.env`, then
          restart the frontend. Enter coordinates manually below.
        </p>
      )}
      <div ref={mapRef} className={cn("w-full h-64 rounded-md border bg-muted", !MAPS_KEY && "hidden")} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("web.address.latitude")}</Label>
          <Input
            type="number"
            step="any"
            value={value.latitude ?? ""}
            onChange={(e) => onChange({ ...value, latitude: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
        <div>
          <Label>{t("web.address.longitude")}</Label>
          <Input
            type="number"
            step="any"
            value={value.longitude ?? ""}
            onChange={(e) => onChange({ ...value, longitude: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>
    </div>
  );
}

export default function AddressFields({ value, onChange, className }: Props) {
  const { t } = useI18n();
  function set<K extends keyof AddressValue>(key: K, v: AddressValue[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label>{t("web.address.line1Required")}</Label>
          <Input value={value.address_line1} onChange={(e) => set("address_line1", e.target.value)} required />
        </div>
        <div className="md:col-span-2">
          <Label>{t("web.address.line2")}</Label>
          <Input value={value.address_line2} onChange={(e) => set("address_line2", e.target.value)} />
        </div>
        <div>
          <Label>{t("web.address.cityRequired")}</Label>
          <Input value={value.city} onChange={(e) => set("city", e.target.value)} required />
        </div>
        <div>
          <Label>{t("web.address.districtRequired")}</Label>
          <Input value={value.district} onChange={(e) => set("district", e.target.value)} required />
        </div>
        <div>
          <Label>{t("web.address.stateRequired")}</Label>
          <Input value={value.state} onChange={(e) => set("state", e.target.value)} required />
        </div>
        <div>
          <Label>{t("web.address.pincodeRequired")}</Label>
          <Input value={value.pincode} onChange={(e) => set("pincode", e.target.value)} required />
        </div>
        <div>
          <Label>{t("address.country")}</Label>
          <Input value={value.country || "India"} onChange={(e) => set("country", e.target.value)} />
        </div>
        <div>
          <Label>{t("web.address.locationLabel")}</Label>
          <Input
            value={value.location_label}
            onChange={(e) => set("location_label", e.target.value)}
            placeholder={t("web.address.labelPlaceholder")}
          />
        </div>
      </div>
      <MapLocationPicker value={value} onChange={onChange} />
    </div>
  );
}

declare global {
  interface Window {
    google?: typeof google;
  }
}
