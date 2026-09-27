import { ReactNode } from "react";
import { Calendar, Info, LayoutDashboard } from "lucide-react";
import RolePortalGate from "@/components/RolePortalGate";
import RoleSidebarLayout, { type PortalNavItem } from "@/components/RoleSidebarLayout";

const navigation: PortalNavItem[] = [
  { nameKey: "admin.dashboard", href: "/pujari", icon: LayoutDashboard },
  { nameKey: "nav.bookings", href: "/my-bookings", icon: Calendar },
  { nameKey: "nav.about", href: "/about", icon: Info },
];

export default function PujariLayout({ children }: { children: ReactNode }) {
  return (
    <RolePortalGate role="priest">
      <RoleSidebarLayout
        portalHome="/pujari"
        portalLabel="Pujari"
        navigation={navigation}
        logoutRedirect="/pujari"
      >
        {children}
      </RoleSidebarLayout>
    </RolePortalGate>
  );
}
