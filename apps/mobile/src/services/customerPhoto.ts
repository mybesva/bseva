import { ApiError } from "@bseva/api-client";
import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { TOKEN_KEY } from "@bseva/tokens";
import type { ImageSourcePropType } from "react-native";
import { resolveApiBase } from "@/services/api";

const CACHE_FILE = `${FileSystem.cacheDirectory}bseva_customer_profile_photo.jpg`;

/** Download authenticated profile photo to cache (RN Image headers are unreliable). */
export async function fetchCustomerProfilePhotoSource(): Promise<ImageSourcePropType | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const url = `${resolveApiBase()}/api/v1/customer/profile/photo?t=${Date.now()}`;
  const result = await FileSystem.downloadAsync(url, CACHE_FILE, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (result.status === 404) return null;
  if (result.status >= 400) {
    throw new ApiError("Could not load profile photo", result.status);
  }
  return { uri: `${result.uri}?v=${Date.now()}` };
}

export async function clearCustomerProfilePhotoCache() {
  try {
    await FileSystem.deleteAsync(CACHE_FILE, { idempotent: true });
  } catch {
    /* cache may not exist */
  }
}
