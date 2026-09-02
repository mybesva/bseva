import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Phone, Mail, Facebook, Instagram, Twitter, Youtube, Linkedin } from "lucide-react";
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
import { usePublicConfig, whatsappDisplay, whatsappHref } from "@/hooks/usePublicConfig";

const PinterestIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
  </svg>
);

const WhatsAppIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const TelegramIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const { t, lang, setLang, labels } = useI18n();
  const { config } = usePublicConfig();
  const phoneDisplay = whatsappDisplay(config.bseva_whatsapp_number);
  const supportEmail = config.email_from_support || "support@b-seva.com";

  const navItems = useMemo(() => {
    const base = [
      { label: t("nav.home"), path: "/" },
      { label: t("nav.services"), path: "/services" },
      { label: t("nav.about"), path: "/about" },
      { label: t("nav.contact"), path: "/contact" },
    ];

    const portals = [
      { label: t("nav.customer"), path: "/customer", role: "customer" as const },
      { label: t("nav.pujaris"), path: "/pujari", role: "pujari" as const },
      { label: t("nav.admin"), path: "/admin", role: "admin" as const },
    ];

    if (!user) {
      return [...base, ...portals.map(({ label, path }) => ({ label, path }))];
    }

    const mine = portals.find(
      (p) => p.role === user.role || (p.role === "admin" && user.role === "super_admin")
    );
    return [
      ...base,
      ...(mine ? [{ label: mine.label, path: mine.path }] : []),
      { label: t("nav.bookings"), path: "/my-bookings" },
    ];
  }, [user, t]);

  const socialLinks = [
    { icon: Facebook, href: "https://facebook.com/bseva", label: "Facebook" },
    { icon: Instagram, href: "https://instagram.com/bseva", label: "Instagram" },
    { icon: Twitter, href: "https://twitter.com/bseva", label: "Twitter" },
    { icon: Youtube, href: "https://youtube.com/@bseva", label: "YouTube" },
    { icon: Linkedin, href: "https://linkedin.com/company/bseva", label: "LinkedIn" },
    { icon: PinterestIcon, href: "https://pinterest.com/bseva", label: "Pinterest" },
    { icon: WhatsAppIcon, href: whatsappHref(config.bseva_whatsapp_number), label: "WhatsApp" },
    { icon: TelegramIcon, href: "https://t.me/bseva", label: "Telegram" },
  ];

  const LanguageSelect = ({ className }: { className?: string }) => (
    <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
      <SelectTrigger className={className || "w-[120px] h-8 text-xs"}>
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
            <span className="flex items-center gap-2"><Phone size={14} /> {phoneDisplay}</span>
            <span className="flex items-center gap-2"><Mail size={14} /> {supportEmail}</span>
          </div>
          <div className="flex gap-3 items-center">
            <LanguageSelect className="w-[110px] h-7 text-xs bg-sidebar border-sidebar-border text-sidebar-foreground" />
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
                title={social.label}
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
              <img src="/bseva-logo.png" alt="B-Seva - Traditional Indian Services" className="h-16 md:h-20 w-auto" />
            </a>
          </Link>

          <nav className="hidden lg:flex items-center gap-4 flex-wrap justify-end">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <a
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    location === item.path ? "text-primary font-bold" : "text-foreground/80"
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
          </nav>

          <div className="flex items-center gap-1 lg:hidden">
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
                    <img src="/bseva-logo.png" alt="B-Seva Logo" className="h-10 w-auto" />
                    <span className="font-heading font-bold text-xl text-sidebar">B-SEVA</span>
                  </a>
                </Link>
                <LanguageSelect className="w-full" />
                <nav className="flex flex-col gap-4">
                  {navItems.map((item) => (
                    <Link key={item.path} href={item.path}>
                      <a
                        className={`text-lg font-medium transition-colors hover:text-primary ${
                          location === item.path ? "text-primary" : "text-foreground/80"
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
                </nav>
              </div>
            </SheetContent>
          </Sheet>
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
            <h4 className="font-heading font-bold text-lg mb-4 text-primary">{t("footer.quickLinks")}</h4>
            <ul className="space-y-2 text-sm text-sidebar-foreground/80">
              <li><Link href="/services"><a className="hover:text-primary">{t("nav.services")}</a></Link></li>
              <li><Link href="/customer"><a className="hover:text-primary">{t("nav.customer")}</a></Link></li>
              <li><Link href="/pujari"><a className="hover:text-primary">{t("nav.pujaris")}</a></Link></li>
              <li><Link href="/admin"><a className="hover:text-primary">{t("nav.admin")}</a></Link></li>
              <li><Link href="/about"><a className="hover:text-primary">{t("nav.about")}</a></Link></li>
              <li><Link href="/contact"><a className="hover:text-primary">{t("nav.contact")}</a></Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-bold text-lg mb-4 text-primary">{t("footer.contact")}</h4>
            <ul className="space-y-3 text-sm text-sidebar-foreground/80">
              <li className="flex items-center gap-2"><Phone size={14} /> {phoneDisplay}</li>
              <li className="flex items-center gap-2"><Mail size={14} /> {supportEmail}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-bold text-lg mb-4 text-primary">Legal</h4>
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
