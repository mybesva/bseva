import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { MapPinPicker } from "@/components/MapPinPicker";
import { AppText, Field, PrimaryButton } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import {
  getDeviceCoordinates,
  LocationDisabledError,
  LocationPermissionError,
  reverseGeocodeParts,
} from "@/utils/deviceLocation";

type PlaceSuggestion = {
  id: string;
  description: string;
  lat?: number;
  lng?: number;
};

function mapsKey() {
  return (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
}

async function fetchSuggestions(query: string, key: string): Promise<PlaceSuggestion[]> {
  if (key) {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:in&key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status?: string;
      predictions?: { place_id: string; description: string }[];
    };
    if (data.status === "OK" && data.predictions?.length) {
      return data.predictions.slice(0, 6).map((p) => ({ id: p.place_id, description: p.description }));
    }
  }
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=in&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "BSevaMobile/1.0" } });
  const rows = (await res.json()) as { place_id?: number; display_name?: string; lat?: string; lon?: string }[];
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row.display_name && row.lat && row.lon)
    .map((row) => ({
      id: String(row.place_id || `${row.lat},${row.lon}`),
      description: String(row.display_name),
      lat: Number(row.lat),
      lng: Number(row.lon),
    }));
}

export function BookingMapLocation({
  latitude,
  longitude,
  onCoordinatesChange,
  onReverseGeocoded,
}: {
  latitude: number | null;
  longitude: number | null;
  onCoordinatesChange: (lat: number, lng: number) => void;
  onReverseGeocoded?: (parts: { street?: string; city?: string; door?: string }) => void;
}) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const [mapError, setMapError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const skipSuggestRef = useRef(false);

  async function reverseGeocode(lat: number, lng: number) {
    const geo = await reverseGeocodeParts(lat, lng);
    if (!geo || !onReverseGeocoded) return;
    onReverseGeocoded({
      street: geo.street || geo.label,
      city: geo.city,
      door: geo.door,
    });
    if (geo.label) {
      skipSuggestRef.current = true;
      setSearch(geo.label);
    }
  }

  async function useCurrentLocation() {
    setMapError(null);
    setPending(true);
    setSuggestOpen(false);
    try {
      const pos = await getDeviceCoordinates();
      onCoordinatesChange(pos.latitude, pos.longitude);
      await reverseGeocode(pos.latitude, pos.longitude);
    } catch (e) {
      if (e instanceof LocationPermissionError) setMapError(t("web.address.permissionDenied"));
      else if (e instanceof LocationDisabledError) setMapError(t("web.address.currentUnavailable"));
      else setMapError(t("web.address.currentFailed"));
    } finally {
      setPending(false);
    }
  }

  async function applyCoords(lat: number, lng: number, label?: string) {
    onCoordinatesChange(lat, lng);
    if (label) {
      skipSuggestRef.current = true;
      onReverseGeocoded?.({ street: label });
      setSearch(label);
    } else {
      await reverseGeocode(lat, lng);
    }
  }

  async function selectSuggestion(item: PlaceSuggestion) {
    skipSuggestRef.current = true;
    setSuggestOpen(false);
    setSuggestions([]);
    setSearch(item.description);
    setPending(true);
    setMapError(null);
    try {
      if (item.lat != null && item.lng != null && Number.isFinite(item.lat) && Number.isFinite(item.lng)) {
        await applyCoords(item.lat, item.lng, item.description);
        return;
      }
      const key = mapsKey();
      if (!key) {
        setMapError(t("web.address.locationNotFound"));
        return;
      }
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(item.id)}&fields=geometry,formatted_address&key=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = (await res.json()) as {
        result?: { formatted_address?: string; geometry?: { location?: { lat: number; lng: number } } };
      };
      const loc = data.result?.geometry?.location;
      if (!loc) {
        setMapError(t("web.address.locationNotFound"));
        return;
      }
      await applyCoords(loc.lat, loc.lng, data.result?.formatted_address || item.description);
    } catch {
      setMapError(t("web.address.locationNotFound"));
    } finally {
      setPending(false);
    }
  }

  async function searchAddress() {
    const q = search.trim();
    if (!q) return;
    if (suggestions[0]) {
      await selectSuggestion(suggestions[0]);
      return;
    }
    const key = mapsKey();
    setPending(true);
    setMapError(null);
    setSuggestOpen(false);
    try {
      if (key) {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&components=country:IN&key=${encodeURIComponent(key)}`;
        const res = await fetch(url);
        const data = (await res.json()) as {
          results?: { geometry?: { location?: { lat: number; lng: number } }; formatted_address?: string }[];
        };
        const loc = data.results?.[0]?.geometry?.location;
        if (!loc) {
          setMapError(t("web.address.locationNotFound"));
          return;
        }
        await applyCoords(loc.lat, loc.lng, data.results?.[0]?.formatted_address);
        return;
      }
      const rows = await fetchSuggestions(q, "");
      if (!rows[0]?.lat || !rows[0]?.lng) {
        setMapError(t("web.address.locationNotFound"));
        return;
      }
      await applyCoords(rows[0].lat, rows[0].lng, rows[0].description);
    } catch {
      setMapError(t("web.address.locationNotFound"));
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (skipSuggestRef.current) {
      skipSuggestRef.current = false;
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }
    const q = search.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetchSuggestions(q, mapsKey())
        .then((rows) => {
          if (cancelled) return;
          setSuggestions(rows);
          setSuggestOpen(rows.length > 0);
        })
        .catch(() => {
          if (!cancelled) {
            setSuggestions([]);
            setSuggestOpen(false);
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const latStr = latitude != null ? String(latitude) : "";
  const lngStr = longitude != null ? String(longitude) : "";

  return (
    <View style={{ gap: 10 }}>
      <AppText variant="small">{t("web.address.mapLocation")}</AppText>
      <View style={{ zIndex: 20 }}>
        <Field
          label={t("web.address.searchPlaceholder")}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => void searchAddress()}
          returnKeyType="search"
          autoComplete="off"
        />
        {suggestOpen && suggestions.length > 0 ? (
          <View
            style={{
              marginTop: 4,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              backgroundColor: colors.card,
              overflow: "hidden",
            }}
          >
            {suggestions.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => void selectSuggestion(item)}
                style={{ paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <AppText variant="small">{item.description}</AppText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <PrimaryButton title={t("common.search")} variant="outline" disabled={pending} onPress={() => void searchAddress()} />
        <PrimaryButton
          title={t("web.address.currentLocation")}
          variant="outline"
          disabled={pending}
          onPress={() => void useCurrentLocation()}
        />
      </View>
      {mapError ? <AppText variant="small" color={colors.destructive}>{mapError}</AppText> : null}
      <MapPinPicker
        latitude={latitude}
        longitude={longitude}
        height={256}
        onChange={(la, ln) => {
          onCoordinatesChange(la, ln);
          void reverseGeocode(la, ln);
        }}
      />
      <AppText variant="small" color={colors.mutedForeground}>{t("web.booking.pinHint")}</AppText>
      {latitude != null && longitude != null ? (
        <AppText variant="small" color={colors.mutedForeground}>
          GPS {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </AppText>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field
            label={t("web.address.latitude")}
            value={latStr}
            keyboardType="decimal-pad"
            onChangeText={(raw) => {
              const n = Number(raw);
              if (!raw.trim() || !Number.isFinite(n) || longitude == null) return;
              onCoordinatesChange(n, longitude);
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label={t("web.address.longitude")}
            value={lngStr}
            keyboardType="decimal-pad"
            onChangeText={(raw) => {
              const n = Number(raw);
              if (!raw.trim() || !Number.isFinite(n) || latitude == null) return;
              onCoordinatesChange(latitude, n);
            }}
          />
        </View>
      </View>
      {!mapsKey() ? (
        <AppText variant="small" color={colors.mutedForeground}>
          <Ionicons name="location-outline" size={14} /> Type an address to see suggestions, tap the map to drop a pin, or use current location.
        </AppText>
      ) : null}
    </View>
  );
}
