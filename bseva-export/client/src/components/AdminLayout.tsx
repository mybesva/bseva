import { ReactNode } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
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

interface AdminLayoutProps {
  children: ReactNode;
}

type UserRole = "admin" | "manager" | "staff";

interface NavItem {
  nameKey: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  roles: UserRole[];
}

const navigation: NavItem[] = [
  { nameKey: "admin.dashboard", href: "/admin", icon: LayoutDashboard, roles: ["admin", "manager", "staff"] },
  { nameKey: "admin.customers", href: "/admin/customers", icon: Users, roles: ["admin", "manager"] },
  { nameKey: "admin.pujaris", href: "/admin/pujaris", icon: UserCog, roles: ["admin", "manager"] },
  { nameKey: "admin.temples", href: "/admin/temples", icon: Church, roles: ["admin", "manager"] },
  { nameKey: "admin.services", href: "/admin/services", icon: Sparkles, roles: ["admin", "manager", "staff"] },
  { nameKey: "admin.samagri", href: "/admin/samagri", icon: Flower2, roles: ["admin", "manager", "staff"] },
  { nameKey: "admin.bookings", href: "/admin/bookings", icon: Calendar, roles: ["admin", "manager", "staff"] },
  { nameKey: "admin.payments", href: "/admin/payments", icon: CreditCard, roles: ["admin", "manager"] },
  { nameKey: "admin.reviews", href: "/admin/reviews", icon: Star, roles: ["admin", "manager", "staff"] },
  { nameKey: "admin.notifications", href: "/admin/notifications", icon: Bell, roles: ["admin", "manager"] },
  { nameKey: "admin.reports", href: "/admin/reports", icon: BarChart3, roles: ["admin", "manager"] },
  { nameKey: "admin.settings", href: "/admin/settings", icon: Settings, roles: ["admin"] },
];

const adminSidebarActionClass =
  "flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground hover:bg-sidebar-accent/50";

function AdminShell({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, loading } = useAuth();
  const { lang, setLang, labels, t } = useI18n();
  const userRole: UserRole = "admin";
  const filteredNavigation = navigation.filter((item) => item.roles.includes(userRole));

  const handleLogout = async () => {
    await logout();
    setLocation("/admin");
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
          "fixed top-0 left-0 z-50 h-full w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border">
            <Link href="/admin">
              <div className="flex items-center gap-2">
                <img src="/bseva-logo.png" alt="B-Seva" className="h-8" />
                <span className="font-heading font-bold text-lg text-sidebar-foreground">Admin</span>
              </div>
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </Button>
          </div>

          <ScrollArea className="flex-1 px-3 py-4">
            <nav className="space-y-1">
              {filteredNavigation.map((item) => {
                const isActive =
                  location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href}>
                    <a
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        isActive
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
              <Link href="/admin/legal">
                <a
                  className={cn(
                    adminSidebarActionClass,
                    (location === "/admin/legal" || location.startsWith("/admin/legal")) &&
                      "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <FileText size={18} />
                  Terms & Conditions
                </a>
              </Link>
              <button
                type="button"
                className={adminSidebarActionClass}
                onClick={() => {
                  setSidebarOpen(false);
                  void handleLogout();
                }}
              >
                <LogOut size={18} />
                Logout
              </button>
            </nav>
          </ScrollArea>

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
                <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email || "admin@bseva.com"}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="h-16 bg-background border-b border-border flex items-center px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden mr-2" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">
              {navigation.find(
                (item) => location === item.href || (item.href !== "/admin" && location.startsWith(item.href))
              )?.name || "Dashboard"}
            </h1>
          </div>
        </header>
        <main className="p-4 lg:p-6">{children}</main>
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
