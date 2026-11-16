import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import { TOKEN_KEY } from "@bseva/tokens";
import { resolveApiBase } from "@/services/api";

type StorageAccess = {
  requestDirectoryPermissionsAsync: (initialFileUrl?: string | null) => Promise<{ granted: boolean; directoryUri?: string }>;
  createFileAsync: (directoryUri: string, fileName: string, mimeType: string) => Promise<string>;
  getUriForDirectoryInRoot?: (folderName: string) => string;
};

function storageAccess(): StorageAccess | null {
  const api = FileSystem as unknown as { StorageAccessFramework?: StorageAccess };
  return api.StorageAccessFramework ?? null;
}

/** Android folder the user picked once for saving PDFs (Android keeps the permission to it). */
const PDF_SAVE_DIR_KEY = "bseva_pdf_save_dir";

/**
 * Android: ask for a folder, opening the picker at Downloads. Android 11+ does not allow the Downloads folder
 * itself, so the user picks or creates a folder inside it (for example Download/B-Seva). Null if they back out.
 */
async function pickAndroidSaveDir(saf: StorageAccess): Promise<string | null> {
  let initial: string | null = null;
  try {
    initial = saf.getUriForDirectoryInRoot?.("Download") ?? null;
  } catch {
    initial = null;
  }
  const perm = await saf.requestDirectoryPermissionsAsync(initial);
  if (!perm.granted || !perm.directoryUri) return null;
  await SecureStore.setItemAsync(PDF_SAVE_DIR_KEY, perm.directoryUri).catch(() => undefined);
  return perm.directoryUri;
}

async function writeToAndroidDir(saf: StorageAccess, dir: string, cachedUri: string, fileName: string): Promise<string> {
  // Android adds the extension from the mime type (and "(1)" if the name is taken).
  const dest = await saf.createFileAsync(dir, fileName.replace(/\.pdf$/i, ""), "application/pdf");
  const base64 = await FileSystem.readAsStringAsync(cachedUri, { encoding: FileSystem.EncodingType.Base64 });
  await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
  return dest;
}

export type SavedPdf = { uri: string; method: "saved" | "shared" };

/**
 * Download a PDF the user is allowed to see and keep it on the phone.
 * - Android: saved into the folder the user picked (asked only the first time). If they do not pick a folder,
 *   the share sheet opens instead so they can still save it (Files, Drive, WhatsApp...), never an error.
 * - iOS: copied to the app's documents.
 */
export async function downloadAuthorizedPdf(path: string, fileName: string): Promise<SavedPdf> {
  const cachedUri = await cacheAuthorizedPdf(path, fileName);
  const saf = Platform.OS === "android" ? storageAccess() : null;
  if (saf) {
    const remembered = await SecureStore.getItemAsync(PDF_SAVE_DIR_KEY).catch(() => null);
    if (remembered) {
      try {
        return { uri: await writeToAndroidDir(saf, remembered, cachedUri, fileName), method: "saved" };
      } catch {
        // Folder deleted or access removed: forget it and ask again.
        await SecureStore.deleteItemAsync(PDF_SAVE_DIR_KEY).catch(() => undefined);
      }
    }
    const dir = await pickAndroidSaveDir(saf);
    if (dir) return { uri: await writeToAndroidDir(saf, dir, cachedUri, fileName), method: "saved" };
    await shareCachedPdf(cachedUri);
    return { uri: cachedUri, method: "shared" };
  }
  const dest = `${FileSystem.documentDirectory}${fileName}`;
  await FileSystem.deleteAsync(dest, { idempotent: true });
  await FileSystem.copyAsync({ from: cachedUri, to: dest });
  return { uri: dest, method: "saved" };
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

/**
 * Print HTML. Avoid on Android: the HTML is first rendered on the phone, and if that render stalls expo-print
 * stays "busy" ("Another print request is already in progress") until the app restarts. Prefer the PDF.
 */
export async function printHtmlDocument(html: string) {
  const Print = await import("expo-print");
  await Print.printAsync({ html });
}

/** Print a cached PDF file (system print / Save as PDF dialog on iOS & Android). */
export async function printPdfFile(uri: string) {
  const Print = await import("expo-print");
  await Print.printAsync({ uri });
}

/** Print / Save as PDF from the server's PDF; uses the HTML only if the PDF cannot be downloaded. */
export async function printAuthorizedPdf(path: string, fileName: string, fallbackHtml?: string | null) {
  let cached: string;
  try {
    cached = await cacheAuthorizedPdf(path, fileName);
  } catch (e) {
    if (fallbackHtml) return printHtmlDocument(fallbackHtml);
    throw e;
  }
  return printPdfFile(cached);
}
