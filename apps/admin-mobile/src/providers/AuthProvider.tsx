import { ApiError } from "@bseva/api-client";
import { isAdminRole } from "@bseva/config";
import type { AuthUser } from "@bseva/types";
import { TOKEN_KEY } from "@bseva/tokens";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiClient } from "@/services/api";
import { unregisterPushToken } from "@/services/push";

type AuthValue = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  rejectedReason: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectedReason, setRejectedReason] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    let token: string | null = null;
    try {
      token = await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      setUser(null);
      setLoading(false);
      return;
    }
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiClient.me();
      if (!isAdminRole(me.role)) {
        await unregisterPushToken();
        await apiClient.logout();
        setUser(null);
        setRejectedReason("This app is only for Admin and Super Admin accounts.");
      } else {
        setRejectedReason(null);
        setUser(me);
      }
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      if (status === 401 || status === 403) await apiClient.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await unregisterPushToken();
    await apiClient.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      rejectedReason,
      refresh,
      logout,
    }),
    [user, loading, rejectedReason, refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
