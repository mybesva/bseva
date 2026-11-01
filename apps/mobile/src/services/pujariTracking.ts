import { Alert } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import { TOKEN_KEY } from "@bseva/tokens";
import { resolveApiBase } from "@/services/api";
import { ensureForegroundLocation } from "@/utils/deviceLocation";

export const PUJARI_LOCATION_TASK = "bseva-pujari-location";

type ActiveTrack = { bookingId: string; intervalMs: number };

let started = false;
let activeBookingId: string | null = null;
let backgroundConsentPrompt: Promise<boolean> | null = null;

const BACKGROUND_CONSENT_DECLINED_KEY = "bseva_bg_location_declined";
const BACKGROUND_REQUEST_WAIT_MS = 5000;

/** Google Play requires this in-app disclosure before the system background location prompt. */
function askBackgroundConsent(): Promise<boolean> {
  backgroundConsentPrompt ??= new Promise<boolean>((resolve) => {
    Alert.alert(
      "Share Your Location While Travelling",
      "B-Seva Pujari collects your location to show customers your arrival for a confirmed puja, even when the app is closed or not in use. Sharing starts shortly before the puja and stops once you arrive.",
      [
        { text: "Not Now", style: "cancel", onPress: () => resolve(false) },
        { text: "Continue", onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  }).finally(() => {
    backgroundConsentPrompt = null;
  });
  return backgroundConsentPrompt;
}

async function requestBackgroundLocation() {
  const current = await Location.getBackgroundPermissionsAsync();
  if (current.granted || !current.canAskAgain) return;
  if (await SecureStore.getItemAsync(BACKGROUND_CONSENT_DECLINED_KEY)) return;
  if (await askBackgroundConsent()) {
    // The system result can be lost on Android (see ensureForegroundLocation); never let it block tracking.
    await Promise.race([
      Location.requestBackgroundPermissionsAsync(),
      new Promise((resolve) => setTimeout(resolve, BACKGROUND_REQUEST_WAIT_MS)),
    ]);
  } else {
    await SecureStore.setItemAsync(BACKGROUND_CONSENT_DECLINED_KEY, "1");
  }
}

async function postPing(bookingId: string, coords: { latitude: number; longitude: number; accuracy?: number | null }) {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return;
  const url = `${resolveApiBase()}/api/v1/bookings/${bookingId}/location`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy_m: coords.accuracy ?? undefined,
      }),
    });
    if (res.status === 400 || res.status === 403) {
      await stopPujariTracking();
    }
  } catch {
    // Offline: drop this sample; next interval retries with a fresh GPS point.
  }
}

TaskManager.defineTask(PUJARI_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const bookingId = await SecureStore.getItemAsync("bseva_track_booking");
  if (!bookingId) return;
  const locs = (data as { locations?: Location.LocationObject[] })?.locations;
  const last = locs?.[locs.length - 1];
  if (!last?.coords) return;
  await postPing(bookingId, last.coords);
});

export async function syncPujariTracking(active: ActiveTrack | null): Promise<string> {
  if (!active) {
    await stopPujariTracking();
    return "idle";
  }
  if (started && activeBookingId === active.bookingId) {
    return "background";
  }
  if (started && activeBookingId && activeBookingId !== active.bookingId) {
    await stopPujariTracking();
  }
  if ((await ensureForegroundLocation()) !== "granted") return "denied";
  try {
    await requestBackgroundLocation();
  } catch {
    /* foreground-only still useful */
  }
  await SecureStore.setItemAsync("bseva_track_booking", active.bookingId);
  const interval = Math.max(15000, active.intervalMs || 60000);
  try {
    const already = await Location.hasStartedLocationUpdatesAsync(PUJARI_LOCATION_TASK);
    if (!already) {
      await Location.startLocationUpdatesAsync(PUJARI_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: interval,
        distanceInterval: 35,
        deferredUpdatesInterval: interval,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "B-Seva travel tracking",
          notificationBody: "Sharing your location with the customer until you arrive or the puja starts.",
        },
      });
    }
    started = true;
    activeBookingId = active.bookingId;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    await postPing(active.bookingId, pos.coords);
    const bg = await Location.getBackgroundPermissionsAsync();
    return bg.status === "granted" ? "background" : "foreground";
  } catch {
    started = false;
    activeBookingId = null;
    return "error";
  }
}

export async function stopPujariTracking() {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(PUJARI_LOCATION_TASK);
    if (running) await Location.stopLocationUpdatesAsync(PUJARI_LOCATION_TASK);
  } catch {
    /* ignore */
  }
  started = false;
  activeBookingId = null;
  await SecureStore.deleteItemAsync("bseva_track_booking");
}

export function isPujariTrackingStarted() {
  return started;
}
