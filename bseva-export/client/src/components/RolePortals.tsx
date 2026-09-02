import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  User,
  MapPin,
  Wallet,
  Calendar,
  History,
  KeyRound,
  FileText,
  LogOut,
  Menu,
  FolderOpen,
  ScrollText,
  Briefcase,
  Clock,
  Landmark,
  Sparkles,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { api, apiBase, getToken, pujariMediaUrl } from "@/lib/api";
import RolePortalGate from "@/components/RolePortalGate";
import PujariProfileGate from "@/components/PujariProfileGate";
import { LegalInlineLink } from "@/components/LegalModal";
import { useI18n } from "@/i18n/I18nProvider";

type NavItem = { label: string; href: string; icon: React.ComponentType<{ size?: number }> };

const sidebarActionClass =
  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors text-sidebar-foreground hover:bg-sidebar-accent/60";

const customerNav: NavItem[] = [
  { label: "Dashboard", href: "/customer", icon: LayoutDashboard },
  { label: "My Profile", href: "/customer/profile", icon: User },
  { label: "My Address", href: "/customer/address", icon: MapPin },
  { label: "Wallet / Payments", href: "/customer/wallet", icon: Wallet },
  { label: "My Bookings", href: "/customer/bookings", icon: Calendar },
  { label: "Booking History", href: "/customer/history", icon: History },
  { label: "Invoices", href: "/customer/invoices", icon: FileText },
  { label: "Rewards & Referral", href: "/customer/rewards", icon: Sparkles },
  { label: "Support", href: "/customer/support", icon: FileText },
  { label: "Change Password", href: "/customer/change-password", icon: KeyRound },
];

const pujariNav: NavItem[] = [
  { label: "Dashboard", href: "/pujari", icon: LayoutDashboard },
  { label: "Complete Profile", href: "/pujari/onboarding", icon: Sparkles },
  { label: "My Profile", href: "/pujari/profile", icon: User },
  { label: "Address", href: "/pujari/address", icon: MapPin },
  { label: "My Documents", href: "/pujari/documents", icon: FolderOpen },
  { label: "Angikara Patram", href: "/pujari/angikara", icon: ScrollText },
  { label: "Upgrade role", href: "/pujari/services", icon: Briefcase },
  { label: "Experience", href: "/pujari/experience", icon: Briefcase },
  { label: "Availability", href: "/pujari/availability", icon: Clock },
  { label: "Bank / Settlement", href: "/pujari/bank", icon: Landmark },
  { label: "Assess Pujaris", href: "/pujari/head-ratings", icon: Star },
  { label: "Support", href: "/pujari/support", icon: FileText },
  { label: "Change Password", href: "/pujari/change-password", icon: KeyRound },
];

function PortalShell({
  role,
  nav,
  children,
  photoUrl,
  photoRequired,
  headerBelow,
}: {
  role: "customer" | "pujari";
  nav: NavItem[];
  children: ReactNode;
  photoUrl?: string | null;
  photoRequired?: boolean;
  headerBelow?: ReactNode;
}) {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    setLocation("/");
  }

  const initials = (user?.name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const Sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex flex-col items-center text-center gap-2 py-2">
          <Avatar className={cn("border-2 border-primary/30", photoRequired ? "h-24 w-24" : "h-16 w-16")}>
            {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
            <AvatarFallback className="bg-sidebar-accent text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="w-full text-center">
            <p className="font-heading font-bold">{user?.name}</p>
            <p className="text-xs text-sidebar-foreground/70 capitalize">{role}</p>
            {headerBelow}
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-1">
          {nav.map((item) => {
            const active = location === item.href || (item.href !== "/customer" && item.href !== "/pujari" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active ? "bg-sidebar-accent text-primary font-medium" : "hover:bg-sidebar-accent/60"
                  )}
                  onClick={() => setOpen(false)}
                >
                  <item.icon size={18} />
                  {item.label}
                </a>
              </Link>
            );
          })}
          <LegalInlineLink kind="terms" className={sidebarActionClass}>
            <FileText size={18} />
            Terms & Conditions
          </LegalInlineLink>
          <button
            type="button"
            className={sidebarActionClass}
            onClick={() => {
              setOpen(false);
              void handleLogout();
            }}
          >
            <LogOut size={18} />
            Logout
          </button>
        </nav>
      </ScrollArea>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:block w-64 shrink-0 border-r border-border">{Sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] shadow-xl">{Sidebar}</aside>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </Button>
          <Link href="/">
            <a className="font-heading font-bold text-sidebar">BSeva</a>
          </Link>
          <span className="text-sm text-muted-foreground capitalize ml-1">{role} portal</span>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
        <footer className="border-t py-4 text-center text-xs text-muted-foreground">© BSeva. All rights reserved.</footer>
      </div>
    </div>
  );
}

function CustomerShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token || user?.role !== "customer") return;
    fetch(`${apiBase()}/api/v1/customer/profile/photo`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (blob) setPhotoUrl(URL.createObjectURL(blob));
      })
      .catch(() => undefined);
  }, [user?.id]);

  return (
    <PortalShell role="customer" nav={customerNav} photoUrl={photoUrl}>
      {children}
    </PortalShell>
  );
}

function PujariShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { t } = useI18n();
  const { user } = useAuth();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [nav, setNav] = useState(pujariNav);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    void pujariMediaUrl("photo").then(setPhotoUrl);
  }, []);

  useEffect(() => {
    api<any>("/pujari/profile")
      .then((p) => {
        setProfile(p);
        const profileDone = !!p.profile_submitted_at;
        const isHead = !!p.is_head_pujari || user?.role === "head_pujari";
        let next = profileDone
          ? pujariNav.filter((item) => item.href !== "/pujari/onboarding")
          : [...pujariNav];
        if (!isHead) {
          next = next.filter((item) => item.href !== "/pujari/head-ratings");
        }
        setNav(next);
      })
      .catch(() => setNav(pujariNav.filter((item) => item.href !== "/pujari/head-ratings")));
  }, [location, user?.role]);

  const headerBelow = profile ? (() => {
    const approved = Number(profile.approved_level || 0);
    const requested = Number(profile.requested_level || 0);
    const pendingUpgrade = requested > approved;

    return (
      <div className="mt-3 w-full space-y-2 border-t border-sidebar-border/50 pt-3">
        <div className="rounded-md bg-sidebar-accent/30 px-2.5 py-2 text-left">
          <p className="text-[10px] uppercase tracking-wide text-sidebar-foreground/55 mb-0.5">
            {t("pujari.level.current")}
          </p>
          <p className="text-xs font-medium leading-snug text-sidebar-foreground">
            {approved ? t(`pujari.level.l${approved}`) : t("pujari.level.pending")}
          </p>
        </div>
        {pendingUpgrade ? (
          <p className="text-[11px] leading-snug text-sidebar-foreground/75 text-left px-0.5">
            <span className="text-sidebar-foreground/55">{t("pujari.level.requested")}:</span>{" "}
            {t(`pujari.level.l${requested}`)}
          </p>
        ) : null}
        <Link href="/pujari/services">
          <Button
            size="sm"
            variant="outline"
            className="mt-0.5 h-8 w-full text-[11px] border-primary/40 bg-transparent text-primary hover:bg-primary/10"
          >
            {t("pujari.menu.upgradeRole")}
          </Button>
        </Link>
      </div>
    );
  })() : null;

  return (
    <PortalShell role="pujari" nav={nav} photoUrl={photoUrl} photoRequired headerBelow={headerBelow}>
      {children}
    </PortalShell>
  );
}

export function CustomerPortal({ children }: { children: ReactNode }) {
  return (
    <RolePortalGate role="customer">
      <CustomerShell>{children}</CustomerShell>
    </RolePortalGate>
  );
}

export function PujariPortal({ children }: { children: ReactNode }) {
  return (
    <RolePortalGate role="priest">
      <PujariProfileGate>
        <PujariShell>{children}</PujariShell>
      </PujariProfileGate>
    </RolePortalGate>
  );
}
