import type { ComponentType } from "react";
import { useLocation } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { adminBasePath } from "@/const";
import { accessForPath, canAccess } from "@/lib/adminAccess";

/**
 * Route-level gate for back-office pages. The page component (and therefore every API call it
 * makes on mount) only mounts once the admin's permissions are known and allow this route.
 * Otherwise the bare layout renders, which shows a loading state or "no access".
 */
function AdminRouteGate({ page: Page }: { page: ComponentType }) {
  const [location] = useLocation();
  const { user, loading } = useAuth();
  const { permissions, isSuper } = useAdminPermissions(user);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  // Not signed in / not an admin: the layout's portal gate handles redirect or messaging.
  if (!loading && !isAdmin) return <Page />;
  const ready = isSuper || permissions !== null;
  if (loading || !ready) return <AdminLayout>{null}</AdminLayout>;
  if (!canAccess(accessForPath(location, adminBasePath()), isSuper, permissions ?? [])) {
    return <AdminLayout>{null}</AdminLayout>;
  }
  return <Page />;
}

const gatedCache = new WeakMap<ComponentType, ComponentType>();

/** Wrap an admin page component for use in <Route component={...}>. Stable per page, so
 * calling it during render never remounts the page. */
export function adminRoute(Page: ComponentType): ComponentType {
  const hit = gatedCache.get(Page);
  if (hit) return hit;
  const Gated = () => <AdminRouteGate page={Page} />;
  Gated.displayName = `AdminRoute(${Page.displayName || Page.name || "Page"})`;
  gatedCache.set(Page, Gated);
  return Gated;
}
