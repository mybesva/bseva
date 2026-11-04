import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { ensureForegroundLocation } from "@/utils/deviceLocation";

export async function getAppPermissionStatus() {
  const loc = await Location.getForegroundPermissionsAsync();
  // Android picks photos through the system picker with no permission (READ_MEDIA_IMAGES is blocked).
  const photos = Platform.OS === "android" ? { status: "granted" } : await ImagePicker.getMediaLibraryPermissionsAsync();
  const notif = await Notifications.getPermissionsAsync();
  return {
    location: loc.status,
    photos: photos.status,
    notifications: notif.status,
  };
}

export async function requestAppPermissions(): Promise<string> {
  const location = await ensureForegroundLocation();
  const photos = Platform.OS === "android" ? { status: "granted" } : await ImagePicker.requestMediaLibraryPermissionsAsync();
  const camera = await ImagePicker.requestCameraPermissionsAsync();
  const notif = await Notifications.requestPermissionsAsync();
  return `Location: ${location}; Photos: ${photos.status}; Camera: ${camera.status}; Notifications: ${notif.status}`;
}
