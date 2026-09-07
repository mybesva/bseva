import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Church,
  Sparkles,
  Calendar,
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
import { useI18n } from "@/i18n/I18nProvider";
import type { Lang } from "@/i18n/translations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { adminBasePath, adminPath } from "@/const";

interface AdminLayoutProps {
  children: ReactNode;
}

interface NavItem {
  nameKey: string;
  /** Path under the private admin base, e.g. "" or "/customers" */
  suffix: string;
  icon: React.ComponentType<{ size?: number }>;
  permissions?: string[];
  superOnly?: boolean;
}

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
  {
    nameKey: "admin.settlements",
    suffix: "/settlements",
    icon: CreditCard,
    permissions: ["manage_settlements", "view_payments"],
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
  { nameKey: "admin.reports", suffix: "/reports", icon: BarChart3, permissions: ["view_reports"] },
  { nameKey: "admin.settings", suffix: "/settings", icon: Settings, permissions: ["manage_config"] },
];

const adminSidebarActionClass =
  "flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground hover:bg-sidebar-accent/50";

function AdminShell({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, loading } = useAuth();
  const { lang, setLang, labels, t } = useI18n();
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const isSuper = user?.role === "super_admin";
  const opsBase = adminBasePath();

  useEffect(() => {
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) return;
    api<{ role: string; permissions: string[] }>("/admin/me/permissions")
      .then((r) => setPermissions(r.permissions || []))
      .catch(() => setPermissions([]));
  }, [user]);

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
          "fixed top-0 left-0 z-50 h-full w-64 overflow-hidden bg-sidebar border-r border-sidebar-border transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full min-h-0">
          <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border shrink-0">
            <Link href={opsBase}>
              <div className="flex items-center gap-2">
                <img src="/bseva-mark.png" alt="B-Seva" className="h-8 w-auto" />
                <span className="font-heading font-bold text-lg text-sidebar-foreground">Admin</span>
              </div>
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </Button>
          </div>

          <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 space-y-1">
              {filteredNavigation.map((item) => {
                const href = adminPath(item.suffix);
                return (
                  <Link key={item.suffix || "dashboard"} href={href}>
                    <a
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        navActive(item.suffix)
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon size={18} />
                      {t(item.nameKey)}
                    </a>
                  </Link>
                );
              })}
              {showSupport && (
                <Link href={adminPath("/support")}>
                  <a
                    className={cn(
                      adminSidebarActionClass,
                      navActive("/support") && "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <LifeBuoy size={18} />
                    Support
                  </a>
                </Link>
              )}
              <Link href={adminPath("/head-ratings")}>
                <a
                  className={cn(
                    adminSidebarActionClass,
                    navActive("/head-ratings") && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Star size={18} />
                  Head assessments
                </a>
              </Link>
              {showLegal && (
                <Link href={adminPath("/legal")}>
                  <a
                    className={cn(
                      adminSidebarActionClass,
                      navActive("/legal") && "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <FileText size={18} />
                    Terms & Conditions
                  </a>
                </Link>
              )}
          </nav>

          <div className="p-4 border-t border-sidebar-border space-y-3 shrink-0">
            <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
              <SelectTrigger className="w-full h-8 text-xs bg-sidebar border-sidebar-border text-sidebar-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(labels) as Lang[]).map((code) => (
                  <SelectItem key={code} value={code}>
                    {labels[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                {(user?.name || "A").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || "Admin User"}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {user?.role === "super_admin" ? "Super admin" : user?.email || "admin@bseva.com"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="h-16 bg-background border-b border-border flex items-center px-4 lg:px-6 gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">
              {(() => {
                const match = navigation.find((item) => navActive(item.suffix));
                return match ? t(match.nameKey) : "Dashboard";
              })()}
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 ml-auto"
            onClick={() => void handleLogout()}
          >
            <LogOut size={16} className="mr-1.5" />
            Logout
          </Button>
        </header>
        <main className="p-4 lg:p-6" data-scroll-reset>
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
