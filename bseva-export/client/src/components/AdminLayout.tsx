import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Church,
  Sparkles,
  Calendar,
  Video,
  Clock3,
  CreditCard,
  Star,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Flower2,
  BarChart3,
  FileText,
  LifeBuoy,
  IndianRupee,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import RolePortalGate from "@/components/RolePortalGate";
import { Skeleton } from "@/components/ui/skeleton";
import { dictionaries } from "@bseva/locales";
import { api } from "@/lib/api";
import { adminBasePath, adminPath } from "@/const";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell, { CountBadge } from "@/components/NotificationBell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import BSevaLogo from "@/components/BSevaLogo";

interface AdminLayoutProps {
  children: ReactNode;
}

interface NavItem {
  nameKey: string;
  /** Path under the private admin base, e.g. "" or "/customers" */
  suffix: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  permissions?: string[];
  superOnly?: boolean;
}

type NavBadges = {
  bookings?: number;
  virtual_puja?: number;
  muhurtham?: number;
  pujaris?: number;
  payments?: number;
  settlements?: number;
  support?: number;
  tooltips?: Record<string, string>;
};

/** Sidebar items that show ACTION-REQUIRED counts (never unread/visit counts). */
const NAV_BADGE_KEYS: Record<string, keyof Omit<NavBadges, "tooltips">> = {
  "/pujaris": "pujaris",
  "/bookings": "bookings",
  "/virtual-puja": "virtual_puja",
  "/muhurtham": "muhurtham",
  "/settlements": "settlements",
  "/payments": "payments",
};

const navigation: NavItem[] = [
  { nameKey: "admin.dashboard", suffix: "", icon: LayoutDashboard },
  { nameKey: "admin.customers", suffix: "/customers", icon: Users, permissions: ["view_customers"] },
  {
    nameKey: "admin.pujaris",
    suffix: "/pujaris",
    icon: UserCog,
    permissions: ["view_pujaris", "verify_pujaris", "edit_pujaris"],
  },
  { nameKey: "admin.temples", suffix: "/temples", icon: Church, permissions: ["manage_services"] },
  { nameKey: "admin.services", suffix: "/services", icon: Sparkles, permissions: ["manage_services"] },
  {
    nameKey: "admin.recommendations",
    suffix: "/recommendations",
    icon: Lightbulb,
    permissions: ["manage_services"],
  },
  { nameKey: "admin.samagri", suffix: "/samagri", icon: Flower2, permissions: ["manage_samagri"] },
  { nameKey: "admin.bookings", suffix: "/bookings", icon: Calendar, permissions: ["view_bookings", "manage_bookings"] },
  { nameKey: "admin.virtualPuja", suffix: "/virtual-puja", icon: Video, permissions: ["view_bookings", "manage_bookings"] },
  { nameKey: "admin.muhurtham", suffix: "/muhurtham", icon: Clock3, permissions: ["view_bookings", "manage_bookings"] },
  {
    nameKey: "admin.settlements",
    suffix: "/settlements",
    icon: CreditCard,
    permissions: ["manage_settlements", "view_payments"],
  },
  {
    nameKey: "admin.invoices",
    suffix: "/invoices",
    icon: FileText,
    permissions: ["view_payments", "manage_settlements", "manage_bookings"],
  },
  {
    nameKey: "admin.payments",
    suffix: "/payments",
    icon: CreditCard,
    permissions: ["view_payments", "manage_settlements"],
  },
  {
    nameKey: "admin.pricing",
    suffix: "/pricing",
    icon: IndianRupee,
    permissions: ["manage_config", "manage_services"],
  },
  { nameKey: "admin.permissions", suffix: "/permissions", icon: UserCog, permissions: ["manage_admins"] },
  { nameKey: "admin.reviews", suffix: "/reviews", icon: Star, permissions: ["view_bookings"] },
  { nameKey: "admin.notifications", suffix: "/notifications", icon: Bell, permissions: ["manage_config"] },
  { nameKey: "admin.promos", suffix: "/promos", icon: Sparkles, permissions: ["manage_config"] },
  { nameKey: "admin.reports", suffix: "/reports", icon: BarChart3, permissions: ["view_reports"] },
  { nameKey: "admin.settings", suffix: "/settings", icon: Settings, permissions: ["manage_config"] },
];

const adminSidebarActionClass =
  "flex w-full min-w-0 items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground hover:bg-sidebar-accent/50";

function AdminShell({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, loading } = useAuth();
  const t = (key: string) => dictionaries.en[key] || key;
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [badges, setBadges] = useState<NavBadges>({});
  const isSuper = user?.role === "super_admin";
  const opsBase = adminBasePath();

  useEffect(() => {
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) return;
    api<{ role: string; permissions: string[] }>("/admin/me/permissions")
      .then((r) => setPermissions(r.permissions || []))
      .catch(() => setPermissions([]));
  }, [user]);

  useEffect(() => {
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) return;
    const loadBadges = () => {
      api<NavBadges>("/notifications/nav-badges")
        .then(setBadges)
        .catch(() => setBadges({}));
    };
    loadBadges();
    const id = window.setInterval(loadBadges, 30000);
    window.addEventListener("bseva-notifications-changed", loadBadges);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("bseva-notifications-changed", loadBadges);
    };
  }, [user, location]);

  const filteredNavigation = useMemo(() => {
    return navigation.filter((item) => {
      if (isSuper) return true;
      if (item.superOnly) return false;
      if (permissions == null) return item.suffix === "";
      if (!item.permissions?.length) return true;
      return item.permissions.some((p) => permissions.includes(p));
    });
  }, [isSuper, permissions]);

  const showLegal = isSuper || (permissions?.includes("manage_legal") ?? false);
  const showSupport = isSuper || (permissions?.includes("manage_support") ?? false);

  const handleLogout = async () => {
    await logout();
    setLocation(opsBase);
  };

  const adminInitials = (user?.name || "A")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const adminRoleLabel =
    user?.role === "super_admin" ? "Super admin" : user?.role === "admin" ? "Admin" : user?.role || "Admin";

  const navActive = (suffix: string) => {
    const href = adminPath(suffix);
    return location === href || (suffix !== "" && location.startsWith(href));
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 overflow-hidden bg-sidebar border-r border-sidebar-border transition-transform duration-300 lg:translate-x-0 print:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full min-h-0">
          <div className="relative shrink-0 border-b border-sidebar-border p-4">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 lg:hidden text-sidebar-foreground"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </Button>
            <Link href={adminPath("/settings")}>
              <a
                className="flex flex-col items-center gap-2 py-2 text-center"
                onClick={() => setSidebarOpen(false)}
              >
                <Avatar className="h-16 w-16 border-2 border-primary/30">
                  <AvatarFallback className="bg-primary text-lg font-bold text-primary-foreground">
                    {adminInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="w-full min-w-0 px-1">
                  <p className="truncate text-sm font-bold leading-snug text-sidebar-foreground" title={user?.name || undefined}>
                    {user?.name || "Admin User"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-sidebar-foreground/70">{adminRoleLabel}</p>
                </div>
              </a>
            </Link>
          </div>

          <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 space-y-1">
              {filteredNavigation.map((item) => {
                const href = adminPath(item.suffix);
                const badgeKey = NAV_BADGE_KEYS[item.suffix];
                return (
                  <Link key={item.suffix || "dashboard"} href={href}>
                    <a
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-w-0",
                        navActive(item.suffix)
                          ? "bg-primary/15 text-primary font-semibold"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon size={18} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{t(item.nameKey)}</span>
                      {badgeKey ? (
                        <CountBadge count={badges[badgeKey]} tooltip={badges.tooltips?.[badgeKey]} />
                      ) : null}
                    </a>
                  </Link>
                );
              })}
              {showSupport && (
                <Link href={adminPath("/support")}>
                  <a
                    className={cn(
                      adminSidebarActionClass,
                      navActive("/support") && "bg-primary/15 text-primary font-semibold"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <LifeBuoy size={18} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">Support</span>
                    <CountBadge count={badges.support} tooltip={badges.tooltips?.support} />
                  </a>
                </Link>
              )}
              <Link href={adminPath("/head-ratings")}>
                <a
                  className={cn(
                    adminSidebarActionClass,
                    navActive("/head-ratings") && "bg-primary/15 text-primary font-semibold"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Star size={18} />
                  {t("nav.headRatings")}
                </a>
              </Link>
              {showLegal && (
                <Link href={adminPath("/legal")}>
                  <a
                    className={cn(
                      adminSidebarActionClass,
                      navActive("/legal") && "bg-primary/15 text-primary font-semibold"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <FileText size={18} />
                    Terms & Conditions
                  </a>
                </Link>
              )}
          </nav>
        </div>
      </aside>

      <div className="lg:pl-64 print:pl-0">
        <header className="sticky top-0 z-40 h-16 bg-background/95 backdrop-blur border-b border-border flex items-center px-3 sm:px-4 lg:px-6 gap-2 sm:gap-3 print:hidden">
          <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Link href={adminPath("")}>
              <a className="flex min-w-0 items-center gap-2 sm:gap-3" onClick={() => setSidebarOpen(false)}>
                <BSevaLogo variant="full" size="portal" className="h-10 sm:h-11 max-w-[9.5rem]" />
                <span className="truncate text-base sm:text-lg font-bold text-foreground">
                  {isSuper ? "Super Admin" : "Admin"}
                </span>
              </a>
            </Link>
          </div>
          <NotificationBell inboxHref={adminPath("/notifications")} />
          <ThemeToggle className="shrink-0" />
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => void handleLogout()}
          >
            <LogOut size={16} className="mr-1.5" />
            Logout
          </Button>
        </header>
        <main className="p-4 lg:p-6 print:p-0" data-scroll-reset>
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <RolePortalGate role="admin">
      <AdminShell>{children}</AdminShell>
    </RolePortalGate>
  );
}
