import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  UserCog, 
  Church, 
  Sparkles, 
  Package, 
  Calendar, 
  CreditCard, 
  Star, 
  Bell, 
  Settings,
  LogOut,
  Menu,
  X,
  Flower2,
  Mail,
  MessageSquare,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
}

// Role-based navigation configuration
// Roles: admin (full access), manager (limited access), staff (basic access)
type UserRole = "admin" | "manager" | "staff";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  roles: UserRole[]; // Which roles can access this item
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard, roles: ["admin", "manager", "staff"] },
  { name: "Customers", href: "/admin/customers", icon: Users, roles: ["admin", "manager"] },
  { name: "Pujaris", href: "/admin/pujaris", icon: UserCog, roles: ["admin", "manager"] },
  { name: "Temples", href: "/admin/temples", icon: Church, roles: ["admin", "manager"] },
  { name: "Services", href: "/admin/services", icon: Sparkles, roles: ["admin", "manager", "staff"] },
  { name: "Samagri", href: "/admin/samagri", icon: Flower2, roles: ["admin", "manager", "staff"] },
  { name: "Bulk Import", href: "/admin/bulk-import", icon: Package, roles: ["admin"] },
  { name: "Bookings", href: "/admin/bookings", icon: Calendar, roles: ["admin", "manager", "staff"] },
  { name: "Payments", href: "/admin/payments", icon: CreditCard, roles: ["admin", "manager"] },
  { name: "Reviews", href: "/admin/reviews", icon: Star, roles: ["admin", "manager", "staff"] },
  { name: "Notifications", href: "/admin/notifications", icon: Bell, roles: ["admin", "manager"] },
  { name: "Email Templates", href: "/admin/email-templates", icon: Mail, roles: ["admin"] },
  { name: "SMS Templates", href: "/admin/sms-templates", icon: MessageSquare, roles: ["admin"] },
  { name: "Reports", href: "/admin/reports", icon: BarChart3, roles: ["admin", "manager"] },
  { name: "Settings", href: "/admin/settings", icon: Settings, roles: ["admin"] },
];

// Get user role from context/auth (default to admin for now)
const getUserRole = (): UserRole => {
  // In production, this would come from auth context
  // For now, return admin to show all items
  return "admin";
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const userRole = getUserRole();
  
  // Filter navigation items based on user role
  const filteredNavigation = navigation.filter(item => item.roles.includes(userRole));

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border">
            <Link href="/admin">
              <div className="flex items-center gap-2">
                <img src="/bseva-logo.png" alt="B-Seva" className="h-8" />
                <span className="font-heading font-bold text-lg text-sidebar-foreground">
                  Admin
                </span>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-3 py-4">
            <nav className="space-y-1">
              {filteredNavigation.map((item) => {
                const isActive = location === item.href || 
                  (item.href !== "/admin" && location.startsWith(item.href));
                
                return (
                  <Link key={item.name} href={item.href}>
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
                      {item.name}
                    </a>
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>

          {/* User section */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                A
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  Admin User
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  admin@bseva.com
                </p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0">
                <LogOut size={16} />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="h-16 bg-background border-b border-border flex items-center px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden mr-2"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </Button>
          
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">
              {navigation.find(item => 
                location === item.href || 
                (item.href !== "/admin" && location.startsWith(item.href))
              )?.name || "Dashboard"}
            </h1>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
