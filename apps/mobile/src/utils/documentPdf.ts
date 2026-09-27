import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import { TOKEN_KEY } from "@bseva/tokens";
import { resolveApiBase } from "@/services/api";

type StorageAccess = {
  requestDirectoryPermissionsAsync: () => Promise<{ granted: boolean; directoryUri: string }>;
  createFileAsync: (directoryUri: string, fileName: string, mimeType: string) => Promise<string>;
};

function storageAccess(): StorageAccess | null {
  const api = FileSystem as unknown as { StorageAccessFramework?: StorageAccess };
  return api.StorageAccessFramework ?? null;
}

export async function downloadAuthorizedPdf(path: string, fileName: string): Promise<string> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const cached = `${FileSystem.cacheDirectory}${fileName}`;
  const result = await FileSystem.downloadAsync(`${resolveApiBase()}${path}`, cached, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (result.status >= 400) throw new Error("Could not download PDF");
  const saf = Platform.OS === "android" ? storageAccess() : null;
  if (saf) {
    const perm = await saf.requestDirectoryPermissionsAsync();
    if (!perm.granted) throw new Error("Storage permission required");
    const dest = await saf.createFileAsync(perm.directoryUri, fileName, "application/pdf");
    const base64 = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
    await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
    return dest;
  }
  const dest = `${FileSystem.documentDirectory}${fileName}`;
  await FileSystem.copyAsync({ from: result.uri, to: dest });
  return dest;
}

export async function shareCachedPdf(cachedUri: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device");
  await Sharing.shareAsync(cachedUri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
}

export async function cacheAuthorizedPdf(path: string, fileName: string): Promise<string> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const cached = `${FileSystem.cacheDirectory}${fileName}`;
  const result = await FileSystem.downloadAsync(`${resolveApiBase()}${path}`, cached, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (result.status >= 400) throw new Error("Could not download PDF");
  return result.uri;
}

export function pdfAlert(title: string, message: string) {
  Alert.alert(title, message);
}
