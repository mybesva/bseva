import AdminLayout from "@/components/AdminLayout";
import MarketingLayout from "@/components/MarketingLayout";
import { CustomerPortal, PujariPortal } from "@/components/RolePortals";
import { useAuth } from "@/_core/hooks/useAuth";
import type { ReactNode } from "react";

type LayoutProps = {
  children: ReactNode;
  /** Keep public marketing header even when logged in (login/register pages). */
  publicOnly?: boolean;
};

function portalShellForRole(role: string, children: ReactNode) {
  if (role === "customer") {
    return <CustomerPortal>{children}</CustomerPortal>;
  }
  if (role === "pujari" || role === "head_pujari") {
    return <PujariPortal>{children}</PujariPortal>;
  }
  if (role === "admin" || role === "super_admin") {
    return <AdminLayout>{children}</AdminLayout>;
  }
  return <MarketingLayout>{children}</MarketingLayout>;
}

/**
 * App shell: logged-in users stay in their role portal (customer / pujari / admin).
 * Logged-out users see the public marketing site chrome.
 */
export default function Layout({ children, publicOnly = false }: LayoutProps) {
  const { user, loading } = useAuth();

  if (publicOnly || loading || !user) {
    return <MarketingLayout>{children}</MarketingLayout>;
  }

  return portalShellForRole(user.role, children);
}

export { MarketingLayout };
