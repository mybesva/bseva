import { TOKEN_KEY } from "@bseva/tokens";
import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import { resolveApiBase } from "@/services/api";

export async function downloadAuthorizedFile(path: string, filename: string, mimeType: string) {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  const result = await FileSystem.downloadAsync(`${resolveApiBase()}/api/v1${path}`, dest, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (result.status >= 400) throw new Error("Download failed");
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, { mimeType, UTI: mimeType.includes("pdf") ? "com.adobe.pdf" : undefined });
  }
  return result.uri;
}

export async function shareBase64File(base64: string, filename: string, mimeType: string) {
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest, { mimeType });
  }
  return dest;
}
