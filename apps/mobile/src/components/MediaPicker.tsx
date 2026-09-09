import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Alert, View } from "react-native";
import { AppText, PrimaryButton } from "./ui";

export type PickedMedia = { uri: string; name: string; type: string };

async function fromAsset(a: { uri: string; fileName?: string | null; mimeType?: string | null }): Promise<PickedMedia> {
  return {
    uri: a.uri,
    name: a.fileName || "photo.jpg",
    type: a.mimeType || "image/jpeg",
  };
}

export async function pickFromCamera(): Promise<PickedMedia | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Camera", "Camera permission is required to take a photo.");
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
  if (res.canceled || !res.assets[0]) return null;
  return fromAsset(res.assets[0]);
}

export async function pickFromLibrary(): Promise<PickedMedia | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Photos", "Photo library permission is required.");
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsEditing: true,
  });
  if (res.canceled || !res.assets[0]) return null;
  return fromAsset(res.assets[0]);
}

export async function pickFile(): Promise<PickedMedia | null> {
  const res = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    type: ["image/*", "application/pdf"],
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name, type: a.mimeType || "application/pdf" };
}

export function MediaPicker({
  onPicked,
  allowFile,
  cameraLabel = "Take photo",
  libraryLabel = "Choose from photos",
  fileLabel = "Choose file",
}: {
  onPicked: (file: PickedMedia) => void | Promise<void>;
  allowFile?: boolean;
  cameraLabel?: string;
  libraryLabel?: string;
  fileLabel?: string;
}) {
  async function run(fn: () => Promise<PickedMedia | null>) {
    const file = await fn();
    if (file) await onPicked(file);
  }
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="small">On mobile you can take a new photo with the camera, or pick an existing file.</AppText>
      <PrimaryButton title={cameraLabel} variant="navy" onPress={() => void run(pickFromCamera)} />
      <PrimaryButton title={libraryLabel} variant="outline" onPress={() => void run(pickFromLibrary)} />
      {allowFile ? <PrimaryButton title={fileLabel} variant="outline" onPress={() => void run(pickFile)} /> : null}
    </View>
  );
}
