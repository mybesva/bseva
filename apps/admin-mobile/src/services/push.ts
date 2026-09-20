import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { apiClient } from "./api";

/** Per-device token; backend sends via Firebase project b-seva-61ab7 (same Admin SDK as Customer/Pujari). */
const FCM_STORE_KEY = "bseva_admin_fcm_token";

export async function registerPushToken(): Promise<string | null> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== "granted") return null;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("ops", {
        name: "BSeva Admin",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF9933",
      });
    }
    const device = await Notifications.getDevicePushTokenAsync();
    const token = String(device.data || "");
    if (!token || token.length < 20) return null;
    await apiClient.registerFcmToken(token, Platform.OS === "ios" ? "ios" : "android");
    await SecureStore.setItemAsync(FCM_STORE_KEY, token);
    return token;
  } catch (err) {
    console.warn("Admin FCM registration skipped", err);
    return null;
  }
}

export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(FCM_STORE_KEY);
    if (token) await apiClient.removeFcmToken(token);
  } catch {
    /* ignore */
  }
  try {
    await SecureStore.deleteItemAsync(FCM_STORE_KEY);
  } catch {
    /* ignore */
  }
}

export function notificationLink(data: Record<string, unknown> | undefined | null): string | null {
  const link = data?.link;
  return typeof link === "string" && link.trim() ? link.trim() : null;
}
