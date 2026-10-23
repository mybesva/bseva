import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";

type MePermissions = { role: string; is_super_admin?: boolean; permissions: string[] };

/**
 * GET /admin/me/permissions, shared by the route gate and the admin layout. Cached briefly so
 * one navigation doesn't fetch twice; the short TTL means a revoked permission takes effect on
 * the admin's next navigation or refresh.
 */
const TTL_MS = 15_000;
let cache: { uid: string; at: number; promise: Promise<MePermissions> } | null = null;

export function fetchAdminPermissions(uid: string): Promise<MePermissions> {
  const now = Date.now();
  if (cache && cache.uid === uid && now - cache.at < TTL_MS) return cache.promise;
  const promise = api<MePermissions>("/admin/me/permissions").catch((e) => {
    cache = null;
    throw e;
  });
  cache = { uid, at: now, promise };
  return promise;
}

export function clearAdminPermissionsCache() {
  cache = null;
}

/** null while loading; [] on failure (fail closed). */
export function useAdminPermissions(user: { id?: string | number; role?: string } | null | undefined) {
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const uid = user?.id != null ? String(user.id) : "";

  useEffect(() => {
    if (!isAdmin || !uid) return;
    let cancelled = false;
    fetchAdminPermissions(uid)
      .then((r) => !cancelled && setPermissions(r.permissions || []))
      .catch(() => !cancelled && setPermissions([]));
    return () => {
      cancelled = true;
    };
  }, [isAdmin, uid]);

  return { permissions, isSuper: user?.role === "super_admin" };
}

/**
 * Page-level helper for hiding actions the admin cannot perform (works anywhere, including in a
 * page component above <AdminLayout>). UI only: the API enforces every action regardless.
 * While permissions load, can() is false, so action buttons appear once confirmed.
 */
export function useAdminCan() {
  const { user } = useAuth();
  const { permissions, isSuper } = useAdminPermissions(user);
  const can = (...anyOf: string[]) => isSuper || (permissions ?? []).some((p) => anyOf.includes(p));
  return { can, isSuper, ready: isSuper || permissions !== null };
}
