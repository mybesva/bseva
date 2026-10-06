import { Link, useLocation, useSearch } from "wouter";
import FooterRights from "@/components/FooterRights";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Phone, Mail, Facebook, Twitter, Youtube, Linkedin, Download } from "lucide-react";
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
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/landingConfig";
import { MandalaOutline } from "@/components/landing/DevotionalPatterns";

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

/** Phone + email block for the mobile menu sheet. The desktop header intentionally
 *  omits it so the header looks the same on every screen size (footer keeps both). */
function HeaderContact({
  phoneHref,
  phoneDisplay,
  email,
}: {
  phoneHref: string;
  phoneDisplay: string;
  email: string;
}) {
  return (
    <div className="flex flex-col gap-3 text-sm font-semibold">
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
        className="inline-flex items-center gap-1.5 min-h-8 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
        aria-label={`Email ${email}`}
      >
        <Mail size={13} className="shrink-0" aria-hidden />
        <span>{email}</span>
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
      { icon: WhatsAppIcon, href: whatsappHref(config.bseva_whatsapp_number), label: "WhatsApp", color: SOCIAL_BRAND.whatsapp, gradient: undefined as string | undefined },
      { icon: InstagramIcon, href: "https://instagram.com/bseva", label: "Instagram", color: null as string | null, gradient: INSTAGRAM_GRADIENT },
      { icon: Youtube, href: "https://youtube.com/@bseva", label: "YouTube", color: SOCIAL_BRAND.youtube, gradient: undefined },
      { icon: Facebook, href: "https://facebook.com/bseva", label: "Facebook", color: SOCIAL_BRAND.facebook, gradient: undefined },
      { icon: Twitter, href: "https://twitter.com/bseva", label: "X", color: SOCIAL_BRAND.twitter, gradient: undefined },
      { icon: Linkedin, href: "https://linkedin.com/company/bseva", label: "LinkedIn", color: SOCIAL_BRAND.linkedin, gradient: undefined },
    ],
    [config.bseva_whatsapp_number],
  );

  const LanguageSelect = ({ triggerClassName }: { triggerClassName?: string }) => (
    <LanguageSelector triggerClassName={triggerClassName} />
  );

  const phoneHref = telHref(config.bseva_whatsapp_number);

  const navLinkClass = (path: string) =>
    cn(
      "shrink-0 whitespace-nowrap rounded-sm text-[15px] font-semibold leading-none transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4",
      isNavItemActive(path, location, search) ? "text-primary" : "text-foreground",
    );

  const footerLink =
    "inline-block rounded-sm py-1 text-sm font-medium text-white transition-colors hover:text-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange";

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className={cn(
          "page-header flex h-[4.5rem] items-center gap-3 xl:gap-6",
          location === "/" ? "xl:h-[5.5rem]" : "xl:h-[5.25rem]",
        )}>
          <Link href="/">
            <a
              className="flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label="B-Seva"
            >
              <BSevaLogo variant="full" size="nav" className="dark:rounded-md dark:bg-white dark:px-1" />
            </a>
          </Link>

          {/* Desktop navigation */}
          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-x-3 min-[1200px]:flex xl:gap-x-5 2xl:gap-x-7"
            aria-label={t("lp.nav.primary")}
          >
            {navItems.map((item) =>
              item.path === "/services" ? (
                <ServicesNavMenu key={item.path} active={isNavItemActive(item.path, location, search)} />
              ) : (
                <Link key={item.path} href={item.path}>
                  <a className={navLinkClass(item.path)}>{item.label}</a>
                </Link>
              ),
            )}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 xl:ml-0">
            <Link href="/services">
              <a className="book-puja-nav-cta-wrap shrink-0" aria-label={t("nav.bookPuja")}>
                <span className={cn(
                  "book-puja-nav-cta book-puja-nav-cta-compact xl:h-11 xl:px-5 xl:text-[0.9375rem]",
                  location === "/" && "book-puja-nav-cta-ink",
                )}>
                  {t("nav.bookPuja")}
                </span>
              </a>
            </Link>
            <div className="hidden md:block">
              <LanguageSelect triggerClassName="h-10 w-[7.5rem] text-[13px] font-semibold xl:w-[8.5rem]" />
            </div>
            <ThemeToggle className="h-10 w-10 shrink-0" />
            {user && (
              <Button
                variant="outline"
                size="sm"
                className="hidden shrink-0 sm:inline-flex"
                onClick={async () => {
                  await logout();
                  setLocation("/");
                }}
              >
                {t("nav.logout")}
              </Button>
            )}

            {/* Tablet / mobile menu */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 min-[1200px]:hidden" aria-label={t("lp.nav.openMenu")}>
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(22rem,92vw)] overflow-y-auto bg-background border-l-border px-6 pb-8">
                {/* shrink-0: the sheet is a fixed-height flex column; without it a tall menu (large
                    phone text) gets squeezed and the Services sub-list collapses over the next links. */}
                <div className="mt-8 flex shrink-0 flex-col gap-7">
                  <Link href="/">
                    <a className="flex items-center" onClick={() => setIsMobileMenuOpen(false)}>
                      <BSevaLogo variant="full" size="lg" />
                    </a>
                  </Link>
                  <LanguageSelect triggerClassName="h-11 w-full" />
                  <nav className="flex flex-col gap-4" aria-label={t("lp.nav.primary")}>
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
                            className={`flex min-h-11 items-center text-lg font-bold transition-colors hover:text-primary ${
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
                    <HeaderContact phoneHref={phoneHref} phoneDisplay={phoneDisplay} email={supportEmail} />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <footer className="relative overflow-hidden bg-sidebar text-white">
        <MandalaOutline className="absolute -bottom-48 -right-40 h-[30rem] w-[30rem] text-white opacity-[0.05]" />
        <div className="container relative z-10 grid grid-cols-2 gap-x-6 gap-y-10 py-14 md:grid-cols-3 lg:grid-cols-12 lg:gap-x-8">
          <div className="col-span-2 md:col-span-3 lg:col-span-4">
            <Link href="/">
              <a className="inline-block rounded-md bg-white px-2 py-1.5" aria-label="B-Seva">
                <BSevaLogo variant="full" size="md" />
              </a>
            </Link>
            <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed text-white">{t("footer.tagline")}</p>
            <ul className="mt-4 space-y-1 text-sm font-medium text-white">
              <li className="flex items-center gap-2">
                <Phone size={14} className="shrink-0 text-brand-orange" aria-hidden />
                <a href={phoneHref} className="rounded-sm hover:text-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
                  {phoneDisplay}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={14} className="shrink-0 text-brand-orange" aria-hidden />
                <a href={`mailto:${supportEmail}`} className="break-all rounded-sm hover:text-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
                  {supportEmail}
                </a>
              </li>
            </ul>
          </div>

          <nav aria-label={t("footer.quickLinks")} className="lg:col-span-2">
            <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-brand-orange">{t("footer.quickLinks")}</h4>
            <ul className="mt-3 space-y-1">
              <li><Link href="/"><a className={footerLink}>{t("nav.home")}</a></Link></li>
              <li><Link href="/services"><a className={footerLink}>{t("nav.services")}</a></Link></li>
              <li><Link href="/#how-it-works"><a className={footerLink}>{t("nav.howItWorks")}</a></Link></li>
              <li><Link href="/customer"><a className={footerLink}>{t("nav.customer")}</a></Link></li>
              <li><Link href="/pujari"><a className={footerLink}>{t("nav.pujaris").replace(/\bPujaris\b/, "Pujari")}</a></Link></li>
            </ul>
          </nav>

          <nav aria-label={t("lp.footer.support")} className="lg:col-span-2">
            <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-brand-orange">{t("lp.footer.support")}</h4>
            <ul className="mt-3 space-y-1">
              <li><Link href="/about"><a className={footerLink}>{t("nav.about")}</a></Link></li>
              <li><Link href="/contact"><a className={footerLink}>{t("nav.contact")}</a></Link></li>
              <li><Link href="/support"><a className={footerLink}>{t("nav.support")}</a></Link></li>
              <li><Link href="/terms"><a className={footerLink}>{t("nav.terms")}</a></Link></li>
              <li><Link href="/privacy"><a className={footerLink}>{t("nav.privacy")}</a></Link></li>
            </ul>
          </nav>

          <nav aria-label={t("lp.footer.followUs")} className="print:hidden lg:col-span-2">
            <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-brand-orange">{t("lp.footer.followUs")}</h4>
            <ul className="mt-3 flex flex-wrap gap-2.5">
              {socialLinks.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    title={social.label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white shadow-sm transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
                    style={social.gradient ? { backgroundImage: social.gradient } : { backgroundColor: social.color ?? undefined }}
                  >
                    <social.icon size={17} />
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {APP_STORE_URL || PLAY_STORE_URL ? (
            <div className="lg:col-span-2">
              <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-brand-orange">{t("lp.footer.downloadApp")}</h4>
              <ul className="mt-3 space-y-2">
                {APP_STORE_URL ? (
                  <li>
                    <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/40 bg-black px-3 text-sm font-semibold text-white hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
                      <Download size={16} aria-hidden /> {t("lp.app.appStore")}
                    </a>
                  </li>
                ) : null}
                {PLAY_STORE_URL ? (
                  <li>
                    <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/40 bg-black px-3 text-sm font-semibold text-white hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
                      <Download size={16} aria-hidden /> {t("lp.app.googlePlay")}
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="relative z-10 border-t border-white/20">
          <div className="container flex flex-col items-center justify-between gap-4 py-5 text-center text-xs font-medium text-white sm:flex-row sm:text-left">
            <p>
              <FooterRights />
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">{t("lp.footer.language")}</span>
              <LanguageSelect triggerClassName="h-9 w-[9rem] border-white/40 bg-transparent text-white [&_svg]:text-white" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
