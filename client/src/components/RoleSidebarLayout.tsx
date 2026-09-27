import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import type { Lang } from "@/i18n/translations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PortalNavItem {
  nameKey: string;
  href: string;
  icon: LucideIcon;
}

interface RoleSidebarLayoutProps {
  children: ReactNode;
  portalHome: string;
  portalLabel: string;
  navigation: PortalNavItem[];
  logoutRedirect: string;
}

function isNavActive(location: string, href: string, portalHome: string) {
  if (location === href) return true;
  if (href === portalHome) return location === portalHome;
  return location.startsWith(`${href}/`) || location.startsWith(href);
}

export default function RoleSidebarLayout({
  children,
  portalHome,
  portalLabel,
  navigation,
  logoutRedirect,
}: RoleSidebarLayoutProps) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, loading } = useAuth();
  const { lang, setLang, labels, t } = useI18n();

  const handleLogout = async () => {
    await logout();
    setLocation(logoutRedirect);
  };

  const activeItem = navigation.find((item) => isNavActive(location, item.href, portalHome));

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen ? (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      ) : null}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border">
            <Link href={portalHome}>
              <a className="flex items-center gap-2">
                <img src="/bseva-logo.png" alt="B-Seva" className="h-8" />
                <span className="font-heading font-bold text-lg text-sidebar-foreground">{portalLabel}</span>
              </a>
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </Button>
          </div>

          <ScrollArea className="flex-1 px-3 py-4">
            <nav className="space-y-1">
              {navigation.map((item) => {
                const isActive = isNavActive(location, item.href, portalHome);
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
            </nav>
          </ScrollArea>

          <div className="p-4 border-t border-sidebar-border space-y-3">
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
                {(user?.name || portalLabel.charAt(0)).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || portalLabel}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email || ""}</p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={handleLogout} title={t("nav.logout")}>
                <LogOut size={16} />
              </Button>
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
            <h1 className="text-lg font-semibold text-foreground">{t(activeItem?.nameKey || navigation[0]?.nameKey || "nav.home")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={handleLogout}>
              <LogOut size={14} /> {t("nav.logout")}
            </Button>
            <Link href="/">
              <Button variant="outline" size="sm">
                View Site
              </Button>
            </Link>
          </div>
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
