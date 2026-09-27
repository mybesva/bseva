import { ReactNode } from "react";
import { Calendar, Info, LayoutDashboard, Sparkles } from "lucide-react";
import RolePortalGate from "@/components/RolePortalGate";
import RoleSidebarLayout, { type PortalNavItem } from "@/components/RoleSidebarLayout";

const navigation: PortalNavItem[] = [
  { nameKey: "admin.dashboard", href: "/customer", icon: LayoutDashboard },
  { nameKey: "nav.bookings", href: "/my-bookings", icon: Calendar },
  { nameKey: "nav.services", href: "/services", icon: Sparkles },
  { nameKey: "nav.about", href: "/about", icon: Info },
];

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <RolePortalGate role="customer">
      <RoleSidebarLayout
        portalHome="/customer"
        portalLabel="Customer"
        navigation={navigation}
        logoutRedirect="/customer"
      >
        {children}
      </RoleSidebarLayout>
    </RolePortalGate>
  );
}
