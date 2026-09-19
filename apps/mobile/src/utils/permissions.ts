import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";

export async function getAppPermissionStatus() {
  const loc = await Location.getForegroundPermissionsAsync();
  const photos = await ImagePicker.getMediaLibraryPermissionsAsync();
  const notif = await Notifications.getPermissionsAsync();
  return {
    location: loc.status,
    photos: photos.status,
    notifications: notif.status,
  };
}

export async function requestAppPermissions(): Promise<string> {
  const loc = await Location.requestForegroundPermissionsAsync();
  const photos = await ImagePicker.requestMediaLibraryPermissionsAsync();
  const camera = await ImagePicker.requestCameraPermissionsAsync();
  const notif = await Notifications.requestPermissionsAsync();
  return `Location: ${loc.status}; Photos: ${photos.status}; Camera: ${camera.status}; Notifications: ${notif.status}`;
}
