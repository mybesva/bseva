import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert, Image, Linking, Modal, Platform, View } from "react-native";
import { AppText, PrimaryButton } from "./ui";
import { useI18n } from "@/providers/I18nProvider";

export type PickedMedia = { uri: string; name: string; type: string };

type PermissionStrings = {
  title: string;
  message: string;
  unavailable?: string;
  openSettings?: string;
};

async function fromAsset(a: { uri: string; fileName?: string | null; mimeType?: string | null }): Promise<PickedMedia> {
  return {
    uri: a.uri,
    name: a.fileName || "photo.jpg",
    type: a.mimeType || "image/jpeg",
  };
}

/** Android 16: call get* before request* — request can hang when permission is already granted. */
async function ensureCameraPermission(strings: PermissionStrings): Promise<boolean> {
  let perm = await ImagePicker.getCameraPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) {
    perm = await ImagePicker.requestCameraPermissionsAsync();
  }
  if (perm.granted) return true;
  if (!perm.canAskAgain) {
    Alert.alert(strings.title, strings.message, [
      { text: "Cancel", style: "cancel" },
      { text: strings.openSettings || "Settings", onPress: () => void Linking.openSettings() },
    ]);
  } else {
    Alert.alert(strings.title, strings.message);
  }
  return false;
}

async function ensureLibraryPermission(strings: PermissionStrings): Promise<boolean> {
  let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) {
    perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  }
  if (perm.granted) return true;
  if (!perm.canAskAgain) {
    Alert.alert(strings.title, strings.message, [
      { text: "Cancel", style: "cancel" },
      { text: strings.openSettings || "Settings", onPress: () => void Linking.openSettings() },
    ]);
  } else {
    Alert.alert(strings.title, strings.message);
  }
  return false;
}

export async function pickFromCamera(
  strings: PermissionStrings = { title: "Camera", message: "Camera permission is required to take a photo." },
): Promise<PickedMedia | null> {
  try {
    if (!(await ensureCameraPermission(strings))) return null;
    if (Platform.OS === "android") {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });
    if (res.canceled || !res.assets[0]) return null;
    return fromAsset(res.assets[0]);
  } catch (e: unknown) {
    Alert.alert(strings.title, e instanceof Error ? e.message : strings.unavailable || strings.message);
    return null;
  }
}

export async function pickFromLibrary(
  strings: PermissionStrings = { title: "Photos", message: "Photo library permission is required." },
): Promise<PickedMedia | null> {
  try {
    if (!(await ensureLibraryPermission(strings))) return null;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });
    if (res.canceled || !res.assets[0]) return null;
    return fromAsset(res.assets[0]);
  } catch (e: unknown) {
    Alert.alert(strings.title, e instanceof Error ? e.message : strings.message);
    return null;
  }
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
  aspect?: [number, number];
}) {
  const { t } = useI18n();
  const [pending, setPending] = useState<PickedMedia | null>(null);
  const [busy, setBusy] = useState<"camera" | "library" | "file" | null>(null);

  const permissionStrings = {
    title: t("mobile.camera"),
    message: t("mobile.cameraPermission"),
    unavailable: t("mobile.cameraUnavailable"),
    openSettings: t("mobile.openSettings"),
  };
  const libraryStrings = {
    title: t("mobile.photos"),
    message: t("mobile.photosPermission"),
    openSettings: t("mobile.openSettings"),
  };

  async function choose(kind: "camera" | "library" | "file", fn: () => Promise<PickedMedia | null>) {
    setBusy(kind);
    try {
      const file = await fn();
      if (!file) return;
      if (file.type.startsWith("image/")) {
        setPending(file);
        return;
      }
      await onPicked(file);
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <PrimaryButton
        title={cameraLabel || t("mobile.takePhoto")}
        variant="navy"
        loading={busy === "camera"}
        disabled={busy != null}
        onPress={() => void choose("camera", () => pickFromCamera(permissionStrings))}
      />
      <PrimaryButton
        title={libraryLabel || t("mobile.choosePhotos")}
        variant="outline"
        loading={busy === "library"}
        disabled={busy != null}
        onPress={() => void choose("library", () => pickFromLibrary(libraryStrings))}
      />
      {allowFile ? (
        <PrimaryButton
          title={fileLabel || t("mobile.chooseFile")}
          variant="outline"
          loading={busy === "file"}
          disabled={busy != null}
          onPress={() => void choose("file", pickFile)}
        />
      ) : null}
      <Modal visible={pending != null} animationType="slide" onRequestClose={() => setPending(null)}>
        <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "space-between" }}>
          {pending ? (
            <Image source={{ uri: pending.uri }} style={{ flex: 1 }} resizeMode="contain" accessibilityLabel={t("mobile.usePhoto")} />
          ) : null}
          <View style={{ flexDirection: "row", gap: 12, padding: 16, paddingBottom: 28, backgroundColor: "#111" }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title={t("common.cancel")} variant="outline" onPress={() => setPending(null)} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title={t("mobile.usePhoto")}
                onPress={() => {
                  const file = pending;
                  setPending(null);
                  if (file) void onPicked(file);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
