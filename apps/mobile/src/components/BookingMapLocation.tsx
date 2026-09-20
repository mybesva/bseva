import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useState } from "react";
import { View } from "react-native";
import { MapPinPicker } from "@/components/MapPinPicker";
import { AppText, Field, PrimaryButton } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

function mapsKey() {
  return (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
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

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const rows = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const row = rows[0];
      if (!row || !onReverseGeocoded) return;
      const street = [row.name, row.street, row.district].filter(Boolean).join(", ");
      onReverseGeocoded({
        street: street || row.formattedAddress || undefined,
        city: row.city || row.subregion || undefined,
        door: row.streetNumber || undefined,
      });
    } catch {
      /* optional enrichment */
    }
  }

  async function useCurrentLocation() {
    setMapError(null);
    setPending(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setMapError(t("web.address.permissionDenied"));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      onCoordinatesChange(pos.coords.latitude, pos.coords.longitude);
      await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
    } catch {
      setMapError(t("web.address.currentFailed"));
    } finally {
      setPending(false);
    }
  }

  async function searchAddress() {
    const q = search.trim();
    if (!q) return;
    const key = mapsKey();
    if (!key) {
      setMapError(t("web.address.locationNotFound"));
      return;
    }
    setPending(true);
    setMapError(null);
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&components=country:IN&key=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = (await res.json()) as {
        results?: { geometry?: { location?: { lat: number; lng: number } }; formatted_address?: string }[];
        status?: string;
      };
      const loc = data.results?.[0]?.geometry?.location;
      if (!loc) {
        setMapError(t("web.address.locationNotFound"));
        return;
      }
      onCoordinatesChange(loc.lat, loc.lng);
      if (onReverseGeocoded && data.results?.[0]?.formatted_address) {
        onReverseGeocoded({ street: data.results[0].formatted_address });
      } else {
        await reverseGeocode(loc.lat, loc.lng);
      }
    } catch {
      setMapError(t("web.address.locationNotFound"));
    } finally {
      setPending(false);
    }
  }

  const latStr = latitude != null ? String(latitude) : "";
  const lngStr = longitude != null ? String(longitude) : "";

  return (
    <View style={{ gap: 10 }}>
      <AppText variant="small">{t("web.address.mapLocation")}</AppText>
      <Field
        label={t("web.address.searchPlaceholder")}
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => void searchAddress()}
        returnKeyType="search"
      />
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
        key={`map-${latitude ?? "x"}-${longitude ?? "y"}`}
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
          <Ionicons name="location-outline" size={14} /> Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for the interactive map, or enter coordinates above.
        </AppText>
      ) : null}
    </View>
  );
}
