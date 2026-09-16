import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Alert, View } from "react-native";
import { AppText, PrimaryButton } from "./ui";
import { useI18n } from "@/providers/I18nProvider";

export type PickedMedia = { uri: string; name: string; type: string };

async function fromAsset(a: { uri: string; fileName?: string | null; mimeType?: string | null }): Promise<PickedMedia> {
  return {
    uri: a.uri,
    name: a.fileName || "photo.jpg",
    type: a.mimeType || "image/jpeg",
  };
}

export async function pickFromCamera(strings = { title: "Camera", message: "Camera permission is required to take a photo." }): Promise<PickedMedia | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(strings.title, strings.message);
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
  if (res.canceled || !res.assets[0]) return null;
  return fromAsset(res.assets[0]);
}

export async function pickFromLibrary(strings = { title: "Photos", message: "Photo library permission is required." }): Promise<PickedMedia | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(strings.title, strings.message);
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
  cameraLabel,
  libraryLabel,
  fileLabel,
}: {
  onPicked: (file: PickedMedia) => void | Promise<void>;
  allowFile?: boolean;
  cameraLabel?: string;
  libraryLabel?: string;
  fileLabel?: string;
}) {
  const { t } = useI18n();
  async function run(fn: () => Promise<PickedMedia | null>) {
    const file = await fn();
    if (file) await onPicked(file);
  }
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="small">{t("mobile.mediaHelp")}</AppText>
      <PrimaryButton title={cameraLabel || t("mobile.takePhoto")} variant="navy" onPress={() => void run(() => pickFromCamera({ title: t("mobile.camera"), message: t("mobile.cameraPermission") }))} />
      <PrimaryButton title={libraryLabel || t("mobile.choosePhotos")} variant="outline" onPress={() => void run(() => pickFromLibrary({ title: t("mobile.photos"), message: t("mobile.photosPermission") }))} />
      {allowFile ? <PrimaryButton title={fileLabel || t("mobile.chooseFile")} variant="outline" onPress={() => void run(pickFile)} /> : null}
    </View>
  );
}
