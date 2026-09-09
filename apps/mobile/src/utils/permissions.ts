import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";

export async function requestAppPermissions(): Promise<string> {
  const loc = await Location.requestForegroundPermissionsAsync();
  const photos = await ImagePicker.requestMediaLibraryPermissionsAsync();
  const camera = await ImagePicker.requestCameraPermissionsAsync();
  const notif = await Notifications.requestPermissionsAsync();
  return `Location: ${loc.status}; Photos: ${photos.status}; Camera: ${camera.status}; Notifications: ${notif.status}`;
}
