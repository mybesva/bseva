import { hasAdminPermission } from "@bseva/config";
import type { NavBadges } from "@bseva/types";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { apiClient } from "@/services/api";

type AdminValue = {
  permissions: string[];
  badges: NavBadges;
  can: (needed?: string | string[]) => boolean;
  refresh: () => Promise<void>;
};

const AdminContext = createContext<AdminValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [badges, setBadges] = useState<NavBadges>({});

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [perm, nav] = await Promise.all([apiClient.adminMePermissions(), apiClient.navBadges()]);
      setPermissions(perm.permissions || []);
      setBadges(nav || {});
    } catch {
      setPermissions([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refresh();
    if (!isAuthenticated) return;
    const id = setInterval(() => void refresh(), 30000);
    return () => clearInterval(id);
  }, [isAuthenticated, refresh, user?.id]);

  const value = useMemo<AdminValue>(
    () => ({
      permissions,
      badges,
      can: (needed) => hasAdminPermission(user?.role, permissions, needed),
      refresh,
    }),
    [permissions, badges, user?.role, refresh]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("AdminProvider missing");
  return ctx;
}
