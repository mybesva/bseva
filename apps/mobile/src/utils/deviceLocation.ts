import * as Location from "expo-location";
import { Platform } from "react-native";

export type DeviceCoords = { latitude: number; longitude: number };

export class LocationPermissionError extends Error {
  constructor() {
    super("permission");
    this.name = "LocationPermissionError";
  }
}

export class LocationDisabledError extends Error {
  constructor() {
    super("disabled");
    this.name = "LocationDisabledError";
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getDeviceCoordinates(): Promise<DeviceCoords> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new LocationPermissionError();

  const enabled = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!enabled) throw new LocationDisabledError();

  if (Platform.OS === "android") {
    try {
      await withTimeout(Location.enableNetworkProviderAsync(), 2500);
    } catch {
      /* emulator / dismissed Play Services prompt */
    }
  }

  const last = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000 }).catch(() => null);
  const accuracies = [Location.Accuracy.Lowest, Location.Accuracy.Balanced] as const;
  for (const accuracy of accuracies) {
    try {
      const pos = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy,
          mayShowUserSettingsDialog: true,
        }),
        7000,
      );
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      /* try next accuracy / last known */
    }
  }
  if (last?.coords) {
    return { latitude: last.coords.latitude, longitude: last.coords.longitude };
  }
  throw new Error("unavailable");
}

type ReverseParts = {
  street?: string;
  city?: string;
  door?: string;
  district?: string;
  state?: string;
  pincode?: string;
  country?: string;
  label?: string;
};

async function reverseGeocodeRemote(latitude: number, longitude: number): Promise<ReverseParts | null> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(String(latitude))}&longitude=${encodeURIComponent(String(longitude))}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      locality?: string;
      city?: string;
      principalSubdivision?: string;
      postcode?: string;
      countryName?: string;
      localityInfo?: { administrative?: { name?: string; adminLevel?: number }[] };
      plusCode?: string;
    };
    const admin = data.localityInfo?.administrative || [];
    const district = admin.find((a) => a.adminLevel === 6)?.name || admin.find((a) => a.adminLevel === 5)?.name;
    const city = data.city || data.locality || admin.find((a) => a.adminLevel === 8)?.name;
    const label = [data.locality, city, data.principalSubdivision, data.countryName].filter(Boolean).join(", ");
    if (!city && !label) return null;
    return {
      street: data.locality || city,
      city: city || undefined,
      district: district || undefined,
      state: data.principalSubdivision || undefined,
      pincode: data.postcode || undefined,
      country: data.countryName || undefined,
      label: label || undefined,
    };
  } catch {
    return null;
  }
}

export async function reverseGeocodeParts(latitude: number, longitude: number): Promise<ReverseParts | null> {
  try {
    const rows = await Location.reverseGeocodeAsync({ latitude, longitude });
    const row = rows[0];
    if (row) {
      const street = [row.streetNumber, row.street, row.district].filter(Boolean).join(", ");
      const label = row.formattedAddress || street || row.city;
      if (label || row.city) {
        return {
          street: street || row.name || row.formattedAddress || undefined,
          city: row.city || row.subregion || undefined,
          door: row.streetNumber || undefined,
          district: row.district || row.subregion || undefined,
          state: row.region || undefined,
          pincode: row.postalCode || undefined,
          country: row.country || undefined,
          label: label || undefined,
        };
      }
    }
  } catch {
    /* emulator often has no native geocoder */
  }
  return reverseGeocodeRemote(latitude, longitude);
}

export type PlaceSuggestion = {
  id: string;
  description: string;
  lat?: number;
  lng?: number;
};

export async function searchPlaces(query: string, googleKey?: string): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = (googleKey || "").trim();
  if (key) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&components=country:in&key=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = (await res.json()) as {
        status?: string;
        predictions?: { place_id: string; description: string }[];
      };
      if (data.status === "OK" && data.predictions?.length) {
        return data.predictions.slice(0, 6).map((p) => ({ id: p.place_id, description: p.description }));
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json&countryCode=IN`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      results?: { id?: number; name?: string; admin1?: string; admin2?: string; country?: string; latitude?: number; longitude?: number }[];
    };
    const rows = (data.results || []).filter((r) => r.latitude != null && r.longitude != null);
    if (rows.length) {
      return rows.map((r) => ({
        id: String(r.id || `${r.latitude},${r.longitude}`),
        description: [r.name, r.admin2, r.admin1, r.country].filter(Boolean).join(", "),
        lat: Number(r.latitude),
        lng: Number(r.longitude),
      }));
    }
  } catch {
    /* fall through */
  }
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      features?: { properties?: { osm_id?: number; name?: string; city?: string; state?: string; country?: string }; geometry?: { coordinates?: number[] } }[];
    };
    return (data.features || [])
      .map((f) => {
        const [lng, lat] = f.geometry?.coordinates || [];
        const p = f.properties || {};
        return {
          id: String(p.osm_id || `${lat},${lng}`),
          description: [p.name, p.city, p.state, p.country].filter(Boolean).join(", "),
          lat: Number(lat),
          lng: Number(lng),
        };
      })
      .filter((row) => row.description && Number.isFinite(row.lat) && Number.isFinite(row.lng));
  } catch {
    return [];
  }
}
