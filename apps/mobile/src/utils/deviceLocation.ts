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

  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) throw new LocationDisabledError();

  if (Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      /* user dismissed the improve-location dialog */
    }
  }

  const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 200 });
  try {
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      }),
      12000,
    );
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    if (last?.coords) {
      return { latitude: last.coords.latitude, longitude: last.coords.longitude };
    }
    throw new Error("unavailable");
  }
}

export async function reverseGeocodeParts(latitude: number, longitude: number) {
  try {
    const rows = await Location.reverseGeocodeAsync({ latitude, longitude });
    const row = rows[0];
    if (!row) return null;
    const street = [row.streetNumber, row.street, row.district].filter(Boolean).join(", ");
    return {
      street: street || row.name || row.formattedAddress || undefined,
      city: row.city || row.subregion || undefined,
      door: row.streetNumber || undefined,
      district: row.district || row.subregion || undefined,
      state: row.region || undefined,
      pincode: row.postalCode || undefined,
      country: row.country || undefined,
      label: row.formattedAddress || street || undefined,
    };
  } catch {
    return null;
  }
}
