import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  Clock,
  Landmark,
  Sparkles,
  ListChecks,
  Star,
  Gift,
  Bell,
  Flower2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { api, apiBase, getToken, pujariMediaUrl } from "@/lib/api";
import { releaseStaleUiLocks } from "@/lib/releaseStaleUiLocks";
import RolePortalGate from "@/components/RolePortalGate";
import PujariProfileGate from "@/components/PujariProfileGate";
import ThemeToggle from "@/components/ThemeToggle";
import SeasonalPopup from "@/components/SeasonalPopup";
import BSevaLogo from "@/components/BSevaLogo";
import NotificationBell, { CountBadge } from "@/components/NotificationBell";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSelector } from "@/components/LanguageSelector";

type NavItem = { labelKey: string; href: string; icon: React.ComponentType<{ size?: number }> };

/** Persist sidebar scroll across SPA navigations (nav remounts on route change). */
const sidebarScrollY: Record<string, number> = {};

const customerNav: NavItem[] = [
  { labelKey: "nav.dashboard", href: "/customer", icon: LayoutDashboard },
  { labelKey: "customer.myProfile", href: "/customer/profile", icon: User },
  { labelKey: "customer.myAddress", href: "/customer/address", icon: MapPin },
  { labelKey: "customer.walletPayments", href: "/customer/wallet", icon: Wallet },
  { labelKey: "nav.ourServices", href: "/services", icon: Flower2 },
  { labelKey: "nav.bookings", href: "/customer/bookings", icon: Calendar },
  { labelKey: "nav.notifications", href: "/customer/notifications", icon: Bell },
  { labelKey: "customer.bookingHistory", href: "/customer/history", icon: History },
  { labelKey: "nav.invoices", href: "/customer/invoices", icon: FileText },
  { labelKey: "nav.rewards", href: "/customer/rewards", icon: Sparkles },
  { labelKey: "nav.support", href: "/customer/support", icon: FileText },
  { labelKey: "nav.password", href: "/customer/change-password", icon: KeyRound },
  { labelKey: "nav.terms", href: "/customer/terms", icon: ScrollText },
];

const pujariNav: NavItem[] = [
  { labelKey: "nav.dashboard", href: "/pujari", icon: LayoutDashboard },
  { labelKey: "nav.bookings", href: "/pujari/bookings", icon: Calendar },
  { labelKey: "nav.notifications", href: "/pujari/notifications", icon: Bell },
  { labelKey: "nav.onboarding", href: "/pujari/onboarding", icon: Sparkles },
  { labelKey: "nav.profile", href: "/pujari/profile", icon: User },
  { labelKey: "nav.address", href: "/pujari/address", icon: MapPin },
  { labelKey: "nav.documents", href: "/pujari/documents", icon: FolderOpen },
  { labelKey: "pujari.serviceOffers", href: "/pujari/services", icon: ListChecks },
  { labelKey: "nav.availability", href: "/pujari/availability", icon: Clock },
  { labelKey: "nav.bank", href: "/pujari/bank", icon: Landmark },
  { labelKey: "nav.earnings", href: "/pujari/earnings", icon: Wallet },
  { labelKey: "nav.referral", href: "/pujari/referral", icon: Gift },
  { labelKey: "nav.headRatings", href: "/pujari/head-ratings", icon: Star },
  { labelKey: "nav.support", href: "/pujari/support", icon: FileText },
  { labelKey: "nav.password", href: "/pujari/change-password", icon: KeyRound },
  { labelKey: "nav.terms", href: "/pujari/terms", icon: ScrollText },
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
  const navRef = useRef<HTMLElement | null>(null);
  const scrollKey = `${role}-sidebar`;
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [badges, setBadges] = useState<{
    bookings?: number;
    notifications?: number;
    support?: number;
    tooltips?: Record<string, string>;
  }>({});

  async function handleLogout() {
    await logout();
    releaseStaleUiLocks();
    setLocation("/");
  }

  useEffect(() => {
    setOpen(false);
    releaseStaleUiLocks();
  }, [location]);

  useEffect(() => {
    const loadBadges = () => {
      api<{
        bookings?: number;
        notifications?: number;
        support?: number;
        tooltips?: Record<string, string>;
      }>("/notifications/nav-badges")
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
  }, [location, user?.id]);

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    el.scrollTop = sidebarScrollY[scrollKey] || 0;
  }, [location, scrollKey, nav]);

  const initials = (user?.name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const Sidebar = (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-border shrink-0">
        <div className="flex flex-col items-center text-center gap-2 py-2">
          <Avatar className={cn("border-2 border-primary/30", photoRequired ?"h-24 w-24" :"h-16 w-16")}>
            {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
            <AvatarFallback className="bg-sidebar-accent text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="w-full text-center px-1">
            <p className="font-bold text-sm leading-snug truncate" title={user?.name || undefined}>
              {user?.name}
            </p>
            {user?.public_id ? (
              <p className="text-xs text-sidebar-foreground/60 font-mono mt-0.5 truncate">{user.public_id}</p>
            ) : null}
            <p className="text-xs text-sidebar-foreground/70">
              {role === "pujari" ? t("auth.pujari") : t("auth.customer")}
            </p>
            {headerBelow}
          </div>
        </div>
      </div>
      <nav
        ref={navRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 py-3 space-y-1"
        onScroll={(e) => {
          sidebarScrollY[scrollKey] = (e.target as HTMLElement).scrollTop;
        }}
      >
          {nav.map((item) => {
            const routeActive =
              location === item.href ||
              (item.href !== "/customer" && item.href !== "/pujari" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    routeActive ? "bg-sidebar-accent text-primary font-medium" : "hover:bg-sidebar-accent/60"
                  )}
                  onClick={() => {
                    if (navRef.current) sidebarScrollY[scrollKey] = navRef.current.scrollTop;
                    setOpen(false);
                  }}
                >
                  <item.icon size={18} />
                  {t(item.labelKey)}
                  <CountBadge
                    count={
                      item.href.endsWith("/bookings")
                        ? badges.bookings
                        : item.href.endsWith("/notifications")
                          ? badges.notifications
                          : item.href.endsWith("/support")
                            ? badges.support
                            : 0
                    }
                    tooltip={
                      item.href.endsWith("/bookings")
                        ? t("notifications.unreadBookings", { count: badges.bookings || 0 })
                        : item.href.endsWith("/notifications")
                          ? t("notifications.unreadCount", { count: badges.notifications || 0 })
                          : item.href.endsWith("/support")
                            ? t("notifications.unreadSupport", { count: badges.support || 0 })
                            : undefined
                    }
                  />
                </a>
              </Link>
            );
          })}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex print:block print:min-h-0">
      <aside className="hidden lg:block w-64 shrink-0 border-r border-border h-screen sticky top-0 print:hidden">{Sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] shadow-xl">{Sidebar}</aside>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-2 sm:gap-3 border-b bg-background px-3 sm:px-4 lg:px-6 print:hidden">
          <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setOpen(true)} aria-label={t("nav.openMenu")}>
            <Menu size={22} />
          </Button>
          <Link href={role === "pujari" ? "/pujari" : "/customer"}>
            <a className="flex items-center shrink-0">
              <BSevaLogo variant="full" size="portal" />
            </a>
          </Link>
          {role === "pujari" && user?.name ? (
            <p className="hidden sm:block min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {t("web.pujari.headerWelcome", { name: user.name })}
            </p>
          ) : null}
          <div className="ml-auto flex items-center gap-1 sm:gap-2 min-w-0">
            {role === "customer" ? (
              <Link href="/services">
                <a className="book-puja-cta-wrap">
                  <span className="book-puja-cta inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-primary px-3 sm:px-4 text-sm font-bold text-primary-foreground">
                    {t("nav.bookPuja")}
                  </span>
                </a>
              </Link>
            ) : null}
            <LanguageSelector />
            <NotificationBell inboxHref={role === "pujari" ? "/pujari/notifications" : "/customer/notifications"} />
            <ThemeToggle className="shrink-0" />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => void handleLogout()}
            >
              <LogOut size={16} className="mr-1.5 hidden sm:inline" />
              {t("nav.logout")}
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 print:p-0" data-scroll-reset>
          {children}
        </main>
        <footer className="border-t py-4 text-center text-xs text-muted-foreground print:hidden">{t("footer.rights")}</footer>
      </div>
    </div>
  );
}

function CustomerShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token || user?.role !== "customer") {
      setPhotoUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    const load = () => {
      fetch(`${apiBase()}/api/v1/customer/profile/photo`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.blob() : null))
        .then((blob) => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = blob ? URL.createObjectURL(blob) : null;
          setPhotoUrl(objectUrl);
        })
        .catch(() => setPhotoUrl(null));
    };
    load();
    window.addEventListener("bseva:customer-photo", load);
    return () => {
      window.removeEventListener("bseva:customer-photo", load);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?.id, user?.role]);

  return (
    <PortalShell role="customer" nav={customerNav} photoUrl={photoUrl}>
      {children}
    </PortalShell>
  );
}

function PujariShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();
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
        const pct = Number(p.profile_completion_percentage || 0);
        const fullyVerified =
          p.profile_status === "verified" ||
          (p.verification_status === "approved" && (!!p.profile_submitted_at || pct >= 100));
        const profileDone = !!p.profile_submitted_at || fullyVerified;
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
    const status = String(profile.profile_status || "");
    const pct = Number(profile.profile_completion_percentage || 0);
    const verified =
      status === "verified" ||
      (profile.verification_status === "approved" && (!!profile.profile_submitted_at || pct >= 100));
    const underReview =
      !verified &&
      (status === "under_review" ||
        status === "submitted" ||
        profile.verification_status === "under_review" ||
        !!profile.profile_submitted_at);
    const badgeLabel = verified
      ? t("pujari.verified")
      : underReview
        ? t("pujari.underReview")
        : status === "ready_for_submission"
          ? t("pujari.readyToSubmit")
          : t("pujari.notVerified");

    return (
      <div className="mt-2 w-full space-y-2 border-t border-sidebar-border/50 pt-2">
        <div
          className={`mx-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            verified
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : underReview
                ? "bg-amber-500/20 text-amber-200 border border-amber-500/40"
                : "bg-orange-500/20 text-orange-300 border border-orange-500/40"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              verified ? "bg-emerald-400" : underReview ? "bg-amber-300" : "bg-orange-400"
            }`}
          />
          {badgeLabel}
        </div>
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
      <CustomerShell>
        <SeasonalPopup />
        {children}
      </CustomerShell>
    </RolePortalGate>
  );
}

export function PujariPortal({ children }: { children: ReactNode }) {
  return (
    <RolePortalGate role="priest">
      <PujariProfileGate>
        <PujariShell>
          <SeasonalPopup />
          {children}
        </PujariShell>
      </PujariProfileGate>
    </RolePortalGate>
  );
}
