import { Link, useLocation, useSearch } from "wouter";
import FooterRights from "@/components/FooterRights";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Menu, Phone, Mail, Facebook, Twitter, Youtube, Linkedin } from "lucide-react";
import { releaseStaleUiLocks } from "@/lib/releaseStaleUiLocks";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSelector } from "@/components/LanguageSelector";
import { usePublicConfig, whatsappDisplay, whatsappHref, telHref } from "@/hooks/usePublicConfig";
import ThemeToggle from "@/components/ThemeToggle";
import ServicesNavMenu from "@/components/ServicesNavMenu";
import BSevaLogo from "@/components/BSevaLogo";
import { cn } from "@/lib/utils";

/** Official brand colors — not a shared theme tint */
const SOCIAL_BRAND = {
  facebook: "#1877F2",
  twitter: "#111111",
  youtube: "#FF0000",
  linkedin: "#0A66C2",
  whatsapp: "#25D366",
} as const;

const INSTAGRAM_GRADIENT =
  "radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285AEB 90%)";

const InstagramIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
  </svg>
);

const WhatsAppIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

function portalRoleFromSearch(search: string): "customer" | "pujari" | null {
  const role = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("role");
  if (role === "customer" || role === "pujari") return role;
  return null;
}

/** Highlight Customer/Pujari nav on portal, login, and register flows. */
function isNavItemActive(path: string, location: string, search: string): boolean {
  const pathname = location.split("?")[0];
  if (path === "/") return pathname === "/" || pathname === "";
  if (pathname === path || pathname.startsWith(`${path}/`)) return true;

  const onAuthPath = pathname === "/login" || pathname === "/register";
  if (!onAuthPath) return false;

  const role = portalRoleFromSearch(search);
  if (path === "/customer") {
    return role === "customer" || (pathname === "/register" && role !== "pujari");
  }
  if (path === "/pujari") {
    return role === "pujari";
  }
  return false;
}

function HeaderContact({
  phoneHref,
  phoneDisplay,
  email,
  compact = false,
}: {
  phoneHref: string;
  phoneDisplay: string;
  email: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        compact
          ? "flex flex-col gap-3 text-sm font-semibold"
          : "hidden 2xl:flex flex-col justify-center gap-0.5 text-[11px] font-semibold leading-tight text-foreground",
      )}
    >
      <a
        href={phoneHref}
        className="inline-flex items-center gap-1.5 min-h-8 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
        aria-label={`Call ${phoneDisplay}`}
      >
        <Phone size={13} className="shrink-0" aria-hidden />
        <span>{phoneDisplay}</span>
      </a>
      <a
        href={`mailto:${email}`}
        className={cn(
          "inline-flex items-center gap-1.5 min-h-8 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm",
          !compact && "hidden xl:inline-flex",
        )}
        aria-label={`Email ${email}`}
      >
        <Mail size={13} className="shrink-0" aria-hidden />
        <span className={cn(!compact && "max-w-[11rem] truncate")}>{email}</span>
      </a>
    </div>
  );
}

/** Public marketing site header/footer (Home, Services, login gates, etc.). */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { config } = usePublicConfig();
  const phoneDisplay = whatsappDisplay(config.bseva_whatsapp_number);
  const supportEmail = config.email_from_support || "support@b-seva.com";

  useEffect(() => {
    setIsMobileMenuOpen(false);
    releaseStaleUiLocks();
  }, [location, search]);

  const navItems = useMemo(() => {
    const portals = [
      { label: t("nav.customer"), path: "/customer", role: "customer" as const },
      {
        label: t("nav.pujaris").replace(/\bPujaris\b/, "Pujari"),
        path: "/pujari",
        role: "pujari" as const,
      },
    ];

    const visiblePortals = !user
      ? portals.map(({ label, path }) => ({ label, path }))
      : portals
          .filter(
            (p) =>
              p.role === user.role ||
              (p.role === "pujari" && user.role === "head_pujari"),
          )
          .map(({ label, path }) => ({ label, path }));

    const items = [
      { label: t("nav.home"), path: "/" },
      { label: t("nav.services"), path: "/services" },
      ...visiblePortals,
      { label: t("nav.about"), path: "/about" },
      { label: t("nav.contact"), path: "/contact" },
    ];

    if (user) {
      items.push({ label: t("nav.bookings"), path: "/my-bookings" });
    }
    return items;
  }, [user, t]);

  const socialLinks = useMemo(
    () => [
      { icon: Facebook, href: "https://facebook.com/bseva", label: "Facebook", color: SOCIAL_BRAND.facebook, gradient: undefined as string | undefined },
      { icon: InstagramIcon, href: "https://instagram.com/bseva", label: "Instagram", color: null as string | null, gradient: INSTAGRAM_GRADIENT },
      { icon: Twitter, href: "https://twitter.com/bseva", label: "X", color: SOCIAL_BRAND.twitter, gradient: undefined },
      { icon: Youtube, href: "https://youtube.com/@bseva", label: "YouTube", color: SOCIAL_BRAND.youtube, gradient: undefined },
      { icon: Linkedin, href: "https://linkedin.com/company/bseva", label: "LinkedIn", color: SOCIAL_BRAND.linkedin, gradient: undefined },
      { icon: WhatsAppIcon, href: whatsappHref(config.bseva_whatsapp_number), label: "WhatsApp", color: SOCIAL_BRAND.whatsapp, gradient: undefined },
    ],
    [config.bseva_whatsapp_number],
  );

  const LanguageSelect = ({ triggerClassName }: { triggerClassName?: string }) => (
    <LanguageSelector triggerClassName={triggerClassName} />
  );

  const phoneHref = telHref(config.bseva_whatsapp_number);

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-2 sm:gap-3 min-[1400px]:hidden">
            <Link href="/">
              <a className="flex min-w-0 flex-1 items-center max-w-[58%] sm:max-w-[50%]">
                <BSevaLogo variant="full" size="header" />
              </a>
            </Link>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Link href="/services">
                <a className="book-puja-nav-cta-wrap shrink-0" aria-label={t("nav.bookPuja")}>
                  <span className="book-puja-nav-cta book-puja-nav-cta-compact">{t("nav.bookPuja")}</span>
                </a>
              </Link>
              <ThemeToggle className="h-8 w-8 shrink-0" />
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-background border-l-border">
                <div className="flex flex-col gap-8 mt-8">
                  <Link href="/">
                    <a className="flex items-center" onClick={() => setIsMobileMenuOpen(false)}>
                      <BSevaLogo variant="full" size="lg" />
                    </a>
                  </Link>
                  <LanguageSelect triggerClassName="w-full" />
                  <nav className="flex flex-col gap-4">
                    {navItems.map((item) =>
                      item.path === "/services" ? (
                        <ServicesNavMenu
                          key={item.path}
                          variant="mobile"
                          active={isNavItemActive(item.path, location, search)}
                          onNavigate={() => setIsMobileMenuOpen(false)}
                        />
                      ) : (
                      <Link key={item.path} href={item.path}>
                        <a
                          className={`text-lg font-bold transition-colors hover:text-primary ${
                            isNavItemActive(item.path, location, search) ? "text-primary" : "text-foreground"
                          }`}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {item.label}
                        </a>
                      </Link>
                      ),
                    )}
                    <Link href="/services">
                      <a
                        className="book-puja-nav-cta-wrap w-full mt-2"
                        aria-label={t("nav.bookPuja")}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <span className="book-puja-nav-cta book-puja-nav-cta-block">{t("nav.bookPuja")}</span>
                      </a>
                    </Link>
                    {user && (
                      <Button
                        variant="outline"
                        className="w-full mt-2"
                        onClick={async () => {
                          setIsMobileMenuOpen(false);
                          await logout();
                          setLocation("/");
                        }}
                      >
                        {t("nav.logout")}
                      </Button>
                    )}
                  </nav>
                  <div className="pt-4 border-t border-border">
                    <HeaderContact
                      compact
                      phoneHref={phoneHref}
                      phoneDisplay={phoneDisplay}
                      email={supportEmail}
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
              {user && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={async () => {
                    await logout();
                    setLocation("/");
                  }}
                >
                  {t("nav.logout")}
                </Button>
              )}
            </div>
          </div>

          <div className="hidden min-[1400px]:flex min-[1400px]:h-[7.5rem] min-[1400px]:w-full min-[1400px]:items-center">
            <Link href="/">
              <a className="flex h-full shrink-0 items-center">
                <BSevaLogo variant="full" size="header" />
              </a>
            </Link>

            <div className="w-8 shrink-0 2xl:w-10" aria-hidden />

            <div className="flex min-w-0 flex-1 items-center justify-end">
              <nav
                className="flex shrink-0 items-center gap-x-2.5 pr-4 2xl:pr-5"
                aria-label="Primary"
              >
                {navItems.map((item) =>
                  item.path === "/services" ? (
                    <ServicesNavMenu
                      key={item.path}
                      active={isNavItemActive(item.path, location, search)}
                    />
                  ) : (
                    <Link key={item.path} href={item.path}>
                      <a
                        className={cn(
                          "shrink-0 whitespace-nowrap text-[15px] font-semibold leading-none transition-colors hover:text-primary",
                          isNavItemActive(item.path, location, search) ? "text-primary" : "text-foreground",
                        )}
                      >
                        {item.label}
                      </a>
                    </Link>
                  ),
                )}
              </nav>
            </div>

            <div className="flex shrink-0 items-center gap-2 border-l border-border/60 pl-3 2xl:gap-3 2xl:pl-4">
              <Link href="/services">
                <a className="book-puja-nav-cta-wrap shrink-0" aria-label={t("nav.bookPuja")}>
                  <span className="book-puja-nav-cta">{t("nav.bookPuja")}</span>
                </a>
              </Link>
              <LanguageSelect triggerClassName="w-[7.25rem] 2xl:w-[9.25rem]" />
              <ThemeToggle className="h-8 w-8 shrink-0" />
              {user && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={async () => {
                    await logout();
                    setLocation("/");
                  }}
                >
                  {t("nav.logout")}
                </Button>
              )}
              <HeaderContact phoneHref={phoneHref} phoneDisplay={phoneDisplay} email={supportEmail} />
            </div>
          </div>
        </div>
      </header>

      <aside
        className={cn(
          "fixed z-40 print:hidden hidden lg:flex flex-col gap-2",
          "right-[max(0.5rem,env(safe-area-inset-right))] lg:right-3",
          "top-1/2 -translate-y-1/2",
          isMobileMenuOpen && "invisible pointer-events-none",
        )}
        aria-label="Social media"
      >
        {socialLinks.map((social) => (
          <Tooltip key={social.label}>
            <TooltipTrigger asChild>
              <a
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-110 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                style={{
                  backgroundColor: social.color ?? undefined,
                  backgroundImage: social.gradient,
                }}
              >
                <social.icon size={16} />
              </a>
            </TooltipTrigger>
            <TooltipContent side="left">{social.label}</TooltipContent>
          </Tooltip>
        ))}
      </aside>

      <main className="flex-1">{children}</main>

      <footer className="bg-sidebar text-sidebar-foreground pt-16 pb-8">
        <div className="container grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div>
            <BSevaLogo variant="full" size="md" className="mb-4" />
            <p className="text-sidebar-foreground text-sm leading-relaxed mb-4">
              {t("footer.tagline")}
            </p>
            <div className="space-y-2 text-sm">
              <Link href="/services">
                <a className="text-sidebar-foreground hover:text-primary block">{t("footer.dualCtaClient")}</a>
              </Link>
              <Link href="/register?role=pujari">
                <a className="text-sidebar-foreground hover:text-primary block">{t("footer.dualCtaPujari")}</a>
              </Link>
            </div>
          </div>
          <div>
            <h4 className="text-h4 mb-4 text-primary">{t("footer.quickLinks")}</h4>
            <ul className="space-y-2 text-sm text-sidebar-foreground">
              <li><Link href="/services"><a className="hover:text-primary">{t("nav.services")}</a></Link></li>
              <li><Link href="/#how-it-works"><a className="hover:text-primary">{t("nav.howItWorks")}</a></Link></li>
              <li><Link href="/customer"><a className="hover:text-primary">{t("nav.customer")}</a></Link></li>
              <li><Link href="/register?role=pujari"><a className="hover:text-primary">{t("nav.joinPujari")}</a></Link></li>
              <li><Link href="/about"><a className="hover:text-primary">{t("nav.about")}</a></Link></li>
              <li><Link href="/contact"><a className="hover:text-primary">{t("nav.contact")}</a></Link></li>
              <li><Link href="/support"><a className="hover:text-primary">{t("nav.support")}</a></Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-h4 mb-4 text-primary">{t("footer.contact")}</h4>
            <ul className="space-y-3 text-sm text-sidebar-foreground">
              <li className="flex items-center gap-2">
                <Phone size={14} className="shrink-0" />
                <a href={telHref(config.bseva_whatsapp_number)} className="hover:text-primary transition-colors">
                  {phoneDisplay}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={14} className="shrink-0" />
                <a href={`mailto:${supportEmail}`} className="hover:text-primary transition-colors">
                  {supportEmail}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-h4 mb-4 text-primary">{t("footer.legal")}</h4>
            <ul className="space-y-2 text-sm text-sidebar-foreground">
              <li><Link href="/terms"><a className="hover:text-primary">{t("nav.terms")}</a></Link></li>
              <li><Link href="/privacy"><a className="hover:text-primary">{t("nav.privacy")}</a></Link></li>
            </ul>
          </div>
        </div>
        <div className="container border-t border-sidebar-border pt-6 text-center text-xs font-medium text-sidebar-foreground">
          <FooterRights />
        </div>
      </footer>
    </div>
  );
}
