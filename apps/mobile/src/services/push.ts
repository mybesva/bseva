import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { apiClient } from "./api";

const FCM_STORE_KEY = "bseva_fcm_token";

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
      await Notifications.setNotificationChannelAsync("default", {
        name: "BSeva",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF9933",
      });
    }
    const device = await Notifications.getDevicePushTokenAsync();
    const token = String(device.data || "");
    if (!token || token.length < 20) return null;
    const platform = Platform.OS === "ios" ? "ios" : "android";
    await apiClient.registerFcmToken(token, platform);
    await SecureStore.setItemAsync(FCM_STORE_KEY, token);
    return token;
  } catch (err) {
    console.warn("FCM registration skipped", err);
    return null;
  }
}

export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(FCM_STORE_KEY);
    if (token) await apiClient.removeFcmToken(token);
  } catch {
    /* logout must continue */
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
