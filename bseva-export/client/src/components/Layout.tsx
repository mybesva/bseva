import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Phone, Mail, Facebook, Twitter, Youtube, Linkedin } from "lucide-react";
import { useMemo, useState } from "react";
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
import { usePublicConfig, whatsappDisplay, whatsappHref, telHref } from "@/hooks/usePublicConfig";
import ThemeToggle from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

/** Official brand colors — not a shared theme tint */
const SOCIAL_BRAND = {
  facebook: "#1877F2",
  twitter: "#1DA1F2",
  youtube: "#FF0000",
  linkedin: "#0A66C2",
  whatsapp: "#25D366",
} as const;

const InstagramIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <defs>
      <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
        <stop offset="0%" stopColor="#fdf497" />
        <stop offset="5%" stopColor="#fdf497" />
        <stop offset="45%" stopColor="#fd5949" />
        <stop offset="60%" stopColor="#d6249f" />
        <stop offset="90%" stopColor="#285AEB" />
      </radialGradient>
    </defs>
    <path
      fill="url(#ig-grad)"
      d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
    />
  </svg>
);

const WhatsAppIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
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

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { t, lang, setLang, labels } = useI18n();
  const { config } = usePublicConfig();
  const phoneDisplay = whatsappDisplay(config.bseva_whatsapp_number);
  const supportEmail = config.email_from_support || "support@b-seva.com";

  const navItems = useMemo(() => {
    const base = [
      { label: t("nav.home"), path: "/" },
      { label: t("nav.services"), path: "/services" },
      { label: t("nav.astrology"), path: "/astrology" },
      { label: t("nav.about"), path: "/about" },
      { label: t("nav.contact"), path: "/contact" },
    ];

    const portals = [
      { label: t("nav.customer"), path: "/customer", role: "customer" as const },
      { label: t("nav.pujaris"), path: "/pujari", role: "pujari" as const },
    ];

    if (!user) {
      return [...base, ...portals.map(({ label, path }) => ({ label, path }))];
    }

    const mine = portals.find(
      (p) =>
        p.role === user.role ||
        (p.role === "pujari" && user.role === "head_pujari")
    );
    return [
      ...base,
      ...(mine ? [{ label: mine.label, path: mine.path }] : []),
      { label: t("nav.bookings"), path: "/my-bookings" },
    ];
  }, [user, t]);

  const socialLinks = [
    { icon: Facebook, href: "https://facebook.com/bseva", label: "Facebook", color: SOCIAL_BRAND.facebook, filled: false },
    { icon: InstagramIcon, href: "https://instagram.com/bseva", label: "Instagram", color: null, filled: true },
    { icon: Twitter, href: "https://twitter.com/bseva", label: "Twitter", color: SOCIAL_BRAND.twitter, filled: false },
    { icon: Youtube, href: "https://youtube.com/@bseva", label: "YouTube", color: SOCIAL_BRAND.youtube, filled: false },
    { icon: Linkedin, href: "https://linkedin.com/company/bseva", label: "LinkedIn", color: SOCIAL_BRAND.linkedin, filled: false },
    { icon: WhatsAppIcon, href: whatsappHref(config.bseva_whatsapp_number), label: "WhatsApp", color: SOCIAL_BRAND.whatsapp, filled: true },
  ];

  const LanguageSelect = ({ className }: { className?: string }) => (
    <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
      <SelectTrigger className={className ||"w-[120px] h-8 text-xs"}>
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
  );

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      <div className="bg-sidebar text-sidebar-foreground py-2 text-sm hidden md:block">
        <div className="container flex justify-between items-center">
          <div className="flex gap-6">
            <a
              href={telHref(config.bseva_whatsapp_number)}
              className="flex items-center gap-2 hover:text-primary transition-colors"
            >
              <Phone size={14} /> {phoneDisplay}
            </a>
            <a
              href={`mailto:${supportEmail}`}
              className="flex items-center gap-2 hover:text-primary transition-colors"
            >
              <Mail size={14} /> {supportEmail}
            </a>
          </div>
          <div className="flex gap-3 items-center">
            <ThemeToggle className="h-7 w-7 text-sidebar-foreground hover:text-primary hover:bg-sidebar-accent/50" />
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center justify-center transition-opacity hover:opacity-90",
                  social.filled && social.color && "[&_svg]:fill-current"
                )}
                style={social.color ? { color: social.color } : undefined}
                title={social.label}
                aria-label={social.label}
              >
                <social.icon size={16} />
              </a>
            ))}
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="container flex h-20 items-center justify-between gap-4">
          <Link href="/">
            <a className="flex items-center shrink-0">
              <img src="/bseva-logo-transparent.png" alt="BSeva" className="h-20 md:h-24 w-auto max-w-[11rem] md:max-w-[14rem] object-contain" />
            </a>
          </Link>

          <nav className="hidden lg:flex items-center gap-4 flex-wrap justify-end">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <a
                  className={`text-sm font-bold transition-colors hover:text-primary ${
                    isNavItemActive(item.path, location, search) ? "text-primary" : "text-foreground"
                  }`}
                >
                  {item.label}
                </a>
              </Link>
            ))}
            <LanguageSelect />
            {!user && (
              <Link href="/services">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md">
                  {t("nav.bookPuja")}
                </Button>
              </Link>
            )}
            {user && (
              <Button
                variant="outline"
                size="sm"
                className="ml-1"
                onClick={async () => {
                  await logout();
                  setLocation("/");
                }}
              >
                {t("nav.logout")}
              </Button>
            )}
          </nav>

          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-background border-l-border">
              <div className="flex flex-col gap-8 mt-8">
                <Link href="/">
                  <a className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
                    <img src="/bseva-logo-transparent.png" alt="BSeva" className="h-12 w-auto max-w-[9rem] object-contain" />
                    <span className="font-brand font-bold text-xl text-foreground">B-SEVA</span>
                  </a>
                </Link>
                <LanguageSelect className="w-full" />
                <nav className="flex flex-col gap-4">
                  {navItems.map((item) => (
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
                  ))}
                  {!user && (
                    <Link href="/services">
                      <Button
                        className="w-full mt-2 bg-primary text-primary-foreground font-bold"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {t("nav.bookPuja")}
                      </Button>
                    </Link>
                  )}
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
              </div>
            </SheetContent>
          </Sheet>
            {user && (
              <Button
                variant="outline"
                size="sm"
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
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-sidebar text-sidebar-foreground pt-16 pb-8">
        <div className="container grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div>
            <img src="/bseva-mark.png" alt="B-Seva" className="h-14 mb-4" />
            <p className="text-sidebar-foreground/70 text-sm leading-relaxed mb-4">
              {t("footer.tagline")}
            </p>
          </div>
          <div>
            <h4 className="text-h4 mb-4 text-primary">{t("footer.quickLinks")}</h4>
            <ul className="space-y-2 text-sm text-sidebar-foreground/80">
              <li><Link href="/services"><a className="hover:text-primary">{t("nav.services")}</a></Link></li>
              <li><Link href="/astrology"><a className="hover:text-primary">{t("nav.astrology")}</a></Link></li>
              <li><Link href="/customer"><a className="hover:text-primary">{t("nav.customer")}</a></Link></li>
              <li><Link href="/pujari"><a className="hover:text-primary">{t("nav.pujaris")}</a></Link></li>
              <li><Link href="/about"><a className="hover:text-primary">{t("nav.about")}</a></Link></li>
              <li><Link href="/contact"><a className="hover:text-primary">{t("nav.contact")}</a></Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-h4 mb-4 text-primary">{t("footer.contact")}</h4>
            <ul className="space-y-3 text-sm text-sidebar-foreground/80">
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
            <h4 className="text-h4 mb-4 text-primary">Legal</h4>
            <ul className="space-y-2 text-sm text-sidebar-foreground/80">
              <li><Link href="/terms"><a className="hover:text-primary">Terms & Conditions</a></Link></li>
              <li><Link href="/privacy"><a className="hover:text-primary">Privacy Policy</a></Link></li>
            </ul>
          </div>
        </div>
        <div className="container border-t border-sidebar-border pt-6 text-center text-xs text-sidebar-foreground/50">
          © BSeva. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
