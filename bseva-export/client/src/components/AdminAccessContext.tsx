import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * Effective back-office permissions of the signed-in admin, as returned by
 * GET /admin/me/permissions (resolved server-side from the DB, never from the client).
 * UI convenience only: every action is still enforced by the API.
 */
export type AdminAccessValue = {
  isSuper: boolean;
  permissions: readonly string[];
  /** True when the admin holds ANY of the given permissions (always true for Super Admin). */
  can: (...anyOf: string[]) => boolean;
};

const AdminAccessContext = createContext<AdminAccessValue>({
  isSuper: false,
  permissions: [],
  can: () => false,
});

export function AdminAccessProvider({
  isSuper,
  permissions,
  children,
}: {
  isSuper: boolean;
  permissions: readonly string[];
  children: ReactNode;
}) {
  const value = useMemo<AdminAccessValue>(
    () => ({
      isSuper,
      permissions,
      can: (...anyOf: string[]) => isSuper || anyOf.some((p) => permissions.includes(p)),
    }),
    [isSuper, permissions],
  );
  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess(): AdminAccessValue {
  return useContext(AdminAccessContext);
}
