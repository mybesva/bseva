import { ApiError } from "@bseva/api-client";
import type { ImageSourcePropType } from "react-native";
import { apiClient } from "@/services/api";

type CustomerProfileRow = { profile_photo_path?: string | null };

/** Authenticated image source for customer profile photo (same pattern as pujari media). */
export async function fetchCustomerProfilePhotoSource(): Promise<ImageSourcePropType | null> {
  let profile: CustomerProfileRow | null = null;
  try {
    profile = (await apiClient.getCustomerProfile()) as CustomerProfileRow;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
  if (!profile?.profile_photo_path?.trim()) return null;
  return apiClient.customerPhotoUri();
}
