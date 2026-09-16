import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createApiClient } from "@bseva/api-client";
import { TOKEN_KEY } from "@bseva/tokens";

export function resolveApiBase(): string {
  const env = (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/$/, "");
  if (env) {
    if (Platform.OS === "android") {
      return env.replace(/localhost|127\.0\.0\.1/g, "10.0.2.2");
    }
    return env;
  }
  if (Platform.OS === "android") return "http://10.0.2.2:8000";
  return "http://localhost:8000";
}

export const apiClient = createApiClient({
  getBaseUrl: resolveApiBase,
  tokenStore: {
    getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
    setToken: async (token) => {
      if (!token) await SecureStore.deleteItemAsync(TOKEN_KEY);
      else await SecureStore.setItemAsync(TOKEN_KEY, token);
    },
  },
});
