import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import ServiceCard from "@/components/ServiceCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Bell,
  CalendarCheck,
  ClipboardList,
  FileText,
  Headphones,
  Heart,
  Home as HomeIcon,
  ListChecks,
  Loader2,
  MapPin,
  MessageCircle,
  Search,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { api, dashboardPath } from "@/lib/api";
import { useEffect, useState } from "react";
import { serviceImageUrl } from "@/lib/serviceImage";
import { formatStartingFrom } from "@/lib/servicePricing";
import { useStartBooking } from "@/hooks/useStartBooking";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LandingHeroBackground from "@/components/LandingHeroBackground";

const ICONS = [Sparkles, Heart, HomeIcon, Users, UserCheck, Search];

const CITIES = [
  { value: "all", labelKey: "home.allCities" as const },
  { value: "Bangalore", label: "Bangalore" },
  { value: "Hyderabad", label: "Hyderabad" },
  { value: "Mumbai", label: "Mumbai" },
  { value: "Delhi", label: "Delhi" },
  { value: "Chennai", label: "Chennai" },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function serviceCopyKeys(slug: string | undefined) {
  const s = String(slug || "").toLowerCase();
  if (s.includes("satyanarayan")) {
    return { forKey: "home.svcSatyaFor", descKey: "home.svcSatyaDesc", ctaKey: "home.svcSatyaCta" };
  }
  if (s.includes("griha-pravesh") || s.includes("gruha-pravesh") || s.includes("grihapravesh")) {
    return { forKey: "home.svcGrihaFor", descKey: "home.svcGrihaDesc", ctaKey: "home.svcGrihaCta" };
  }
  if (/homam|havan|homa|yagna|yagya/.test(s)) {
    return { forKey: "home.svcHavanFor", descKey: "home.svcHavanDesc", ctaKey: "home.svcHavanCta" };
  }
  if (/dosha|navagraha|parihara/.test(s)) {
    return { forKey: "home.svcDoshaFor", descKey: "home.svcDoshaDesc", ctaKey: "home.svcDoshaCta" };
  }
  return null;
}

export default function Home() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [, setLocation] = useLocation();
  const { startBooking, bookingBlocked, checking } = useStartBooking();
  const [popular, setPopular] = useState<any[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [heroQ, setHeroQ] = useState("");
  const [heroCity, setHeroCity] = useState("");

  useEffect(() => {
    api<any[]>(`/services?featured=1&lang=${encodeURIComponent(lang)}`)
      .then((rows) => setPopular((rows || []).slice(0, 10)))
      .catch(() => setPopular([]))
      .finally(() => setLoadingPopular(false));
  }, [lang]);

  useEffect(() => {
    document.title = t("home.metaTitle");
    const desc = t("home.metaDesc");
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, [t, lang]);

  useEffect(() => {
    const stored = sessionStorage.getItem("bseva-scroll-to");
    const hash = window.location.hash.replace("#", "");
    const id = stored || hash;
    if (stored) sessionStorage.removeItem("bseva-scroll-to");
    if (!id) return;
    const timer = window.setTimeout(() => scrollToId(id), 80);
    return () => window.clearTimeout(timer);
  }, []);

  function goSearch() {
    const q = heroQ.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (heroCity) params.set("city", heroCity);
    const s = params.toString();
    setLocation(s ? `/services?${s}` : "/services");
  }

  const howSteps = [
    { icon: Search, title: t("home.howStep1Title"), desc: t("home.howStep1Desc") },
    { icon: ClipboardList, title: t("home.howStep2Title"), desc: t("home.howStep2Desc") },
    { icon: CalendarCheck, title: t("home.howStep3Title"), desc: t("home.howStep3Desc") },
    { icon: Bell, title: t("home.howStep4Title"), desc: t("home.howStep4Desc") },
  ];

  const valuePillars = [
    { eyebrow: t("home.valueClarityEyebrow"), title: t("home.feat1Title"), desc: t("home.feat1Desc"), icon: ListChecks },
    { eyebrow: t("home.valueCoordEyebrow"), title: t("home.feat2Title"), desc: t("home.feat2Desc"), icon: MapPin },
    { eyebrow: t("home.valueConfidenceEyebrow"), title: t("home.feat3Title"), desc: t("home.feat3Desc"), icon: MessageCircle },
  ];

  const trustItems = [
    { icon: FileText, title: t("home.trustCollectTitle"), desc: t("home.trustCollectDesc") },
    { icon: MapPin, title: t("home.trustUseTitle"), desc: t("home.trustUseDesc") },
    { icon: CalendarCheck, title: t("home.trustAfterTitle"), desc: t("home.trustAfterDesc") },
    { icon: Headphones, title: t("home.trustSupportTitle"), desc: t("home.trustSupportDesc") },
  ];

  return (
    <Layout>
      <section className="relative min-h-[78vh] lg:min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <LandingHeroBackground />
        </div>

        <div className="container relative z-10 pt-8 pb-20 xl:pt-16 xl:pb-12 text-center px-4 xl:pr-16">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 motion-reduce:animate-none motion-reduce:translate-y-0">
            <span className="inline-block py-1 px-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-eyebrow mb-5">
              {t("home.badge")}
            </span>
            <h1 className="text-display text-primary mb-5 drop-shadow-lg text-balance">
              {t("home.heroTitle1")} {t("home.heroTitle2")}
            </h1>
            <p className="text-body-lg text-white/95 max-w-2xl mx-auto mb-6 drop-shadow">
              {t("home.heroDesc")}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
              <Button
                size="lg"
                className="h-12 px-8 bg-primary text-primary-foreground font-bold shadow-lg"
                onClick={() => setLocation("/services")}
              >
                {t("nav.bookPuja")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 border-white/50 bg-white/10 text-white hover:bg-white/20 hover:text-white font-semibold"
                onClick={() => scrollToId("popular-pujas")}
              >
                {t("home.exploreCeremonies")}
              </Button>
            </div>
            <p className="text-sm text-white/80 mb-8">{t("home.heroTrust")}</p>

            <div className="max-w-2xl mx-auto bg-card rounded-xl shadow-2xl p-2 md:p-3 flex flex-col md:flex-row gap-2 items-center">
              <div className="w-full md:w-44">
                <Select
                  value={heroCity || "all"}
                  onValueChange={(v) => setHeroCity(v === "all" ? "" : v)}
                >
                  <SelectTrigger
                    aria-label={t("home.whereTakePlace")}
                    className="h-12 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm font-bold text-foreground"
                  >
                    <SelectValue placeholder={t("home.whereTakePlace")} />
                  </SelectTrigger>
                  <SelectContent className="border-primary/30 bg-card shadow-lg">
                    {CITIES.map((city) => (
                      <SelectItem
                        key={city.value}
                        value={city.value}
                        className="font-bold text-foreground data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus:bg-primary focus:text-primary-foreground"
                      >
                        {"labelKey" in city ? t(city.labelKey) : city.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 w-full relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground stroke-[2.5]" size={20} aria-hidden />
                <Input
                  value={heroQ}
                  onChange={(e) => setHeroQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && goSearch()}
                  placeholder={t("services.searchPujas")}
                  aria-label={t("home.whatPlanning")}
                  className="h-12 pl-10 border-none bg-secondary/30 focus-visible:ring-0 font-bold text-foreground placeholder:font-semibold placeholder:text-foreground/55"
                />
              </div>
              <Button className="h-12 px-8 w-full md:w-auto bg-primary text-white font-bold" onClick={goSearch}>
                {t("common.search")}
              </Button>
            </div>
            <p className="mt-3 text-xs md:text-sm text-white/75 max-w-xl mx-auto">
              {t("home.searchHint")}
            </p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-12 md:py-16 bg-background scroll-mt-20">
        <div className="container">
          <SectionHeader
            title={t("home.howItWorksTitle")}
            description={t("home.howItWorksDesc")}
            className="mb-8"
          />
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {howSteps.map((step, i) => (
              <li
                key={step.title}
                className="card-hover-premium relative rounded-xl border border-border/60 bg-card p-4 md:p-5 shadow-sm"
              >
                {i < howSteps.length - 1 ? (
                  <span
                    className="hidden lg:block absolute top-8 -right-2 w-4 h-px bg-primary/40"
                    aria-hidden
                  />
                ) : null}
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <step.icon size={18} aria-hidden />
                  </span>
                  <span className="text-xs font-bold tracking-widest uppercase text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="popular-pujas" className="py-14 md:py-16 bg-secondary/20 scroll-mt-20">
        <div className="container">
          <SectionHeader
            subtitle={t("home.offerings")}
            title={t("home.popularPujas")}
            description={t("home.servicesDesc")}
            className="mb-8"
          />

          {loadingPopular ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {popular.map((s, i) => {
                const Icon = ICONS[i % ICONS.length];
                const img = serviceImageUrl(s);
                const starting = formatStartingFrom(s, lang);
                const copy = serviceCopyKeys(s.slug);
                const adminDesc = s.short_description || s.description;
                const desc =
                  adminDesc ||
                  (copy ? t(copy.descKey) : null) ||
                  starting ||
                  (s.bookable ? t("home.availableSoon") : t("services.comingSoonLabel"));
                return (
                  <div
                    key={s.id}
                    onClick={() => setLocation(`/services/${s.slug}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setLocation(`/services/${s.slug}`);
                      }
                    }}
                    role="link"
                    tabIndex={0}
                    className="cursor-pointer min-w-0 h-full"
                  >
                    <ServiceCard
                      title={s.name}
                      occasion={copy ? t(copy.forKey) : undefined}
                      description={desc}
                      startingFrom={starting}
                      image={img}
                      icon={<Icon size={20} />}
                      comingSoon={!s.bookable}
                      bookingDisabled={Boolean(s.bookable && bookingBlocked)}
                      bookingDisabledLabel={checking ? t("services.checkingAvailability") : t("services.bookingUnavailableArea")}
                      onReadMore={() => setLocation(`/services/${s.slug}`)}
                      onBookNow={() => startBooking(s.slug)}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center mt-12">
            <Button
              variant="outline"
              size="lg"
              className="border-primary text-primary hover:bg-primary hover:text-white font-bold px-8"
              onClick={() => setLocation("/services")}
            >
              {t("home.viewMorePujas")}
            </Button>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-16 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="container relative z-10">
          <SectionHeader title={t("home.valueTitle")} description={t("home.valueBody")} className="mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {valuePillars.map((pillar) => (
              <div
                key={pillar.eyebrow}
                className="card-hover-premium flex flex-col items-center text-center p-6 rounded-2xl bg-card/50 border border-border/60 shadow-sm"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                  <pillar.icon size={28} aria-hidden />
                </div>
                <span className="text-eyebrow font-bold text-primary mb-2">{pillar.eyebrow}</span>
                <h3 className="text-h3 text-foreground mb-3">{pillar.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{pillar.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 max-w-4xl mx-auto">
            {[
              t("home.occasionNewHome"),
              t("home.occasionFestival"),
              t("home.occasionParents"),
              t("home.occasionRitual"),
            ].map((line) => (
              <p key={line} className="text-sm text-muted-foreground italic max-w-xs text-center leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20 relative overflow-hidden bg-secondary/15">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-24 h-24 border-t-4 border-l-4 border-primary rounded-tl-3xl" />
              <div className="absolute -bottom-4 -right-4 w-24 h-24 border-b-4 border-r-4 border-primary rounded-br-3xl" />
              <img
                src="/images/temple-ritual.png"
                alt={t("home.missionImageAlt")}
                className="rounded-2xl shadow-2xl w-full object-cover aspect-[4/3]"
              />
            </div>

            <div>
              <span className="text-sm font-bold tracking-[0.2em] uppercase text-primary mb-2 block">
                {t("home.missionLabel")}
              </span>
              <h2 className="text-h2 text-3xl md:text-4xl text-primary mb-6">{t("home.missionTitle")}</h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">{t("home.missionP1")}</p>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{t("home.missionP2")}</p>
              <Button
                className="bg-sidebar text-sidebar-foreground hover:bg-sidebar/90 px-8 h-12"
                onClick={() => scrollToId("how-it-works")}
              >
                {t("home.seeHowItWorks")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-16 bg-secondary/15">
        <div className="container">
          <SectionHeader
            subtitle={t("home.trustSub")}
            title={t("home.trustTitle")}
            description={t("home.trustDesc")}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {trustItems.map((item) => (
              <div key={item.title} className="card-hover-premium rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <item.icon size={20} aria-hidden />
                </div>
                <h3 className="font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20 relative">
        <div className="container">
          <div className="bg-gradient-to-r from-primary to-accent rounded-3xl p-8 md:p-14 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none mix-blend-overlay">
              <img src="/images/mandala-pattern.png" alt="" className="w-full h-full object-cover" />
            </div>

            <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="text-h2 text-3xl md:text-4xl text-foreground mb-6">{t("home.ctaTitle")}</h2>
              <p className="text-xl text-foreground/80 mb-8 font-medium">{t("home.ctaDesc")}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-sidebar text-white hover:bg-sidebar/90 h-14 px-10 text-lg shadow-lg"
                  onClick={() => setLocation("/services")}
                >
                  {t("home.bookNow")}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent border-2 border-sidebar text-foreground hover:bg-sidebar/10 h-14 px-10 text-lg font-bold"
                  onClick={() => setLocation("/contact")}
                >
                  {t("home.contactSupport")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!user && (
        <section className="py-14 bg-secondary/10">
          <div className="container">
            <SectionHeader
              subtitle={t("home.portalsSub")}
              title={t("home.choosePortal")}
              description={t("home.choosePortalDescription")}
              className="mb-8"
            />
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {[
                { role: "customer", title: t("auth.customer"), desc: t("home.customerBlurb"), icon: Users, href: "/customer" },
                { role: "pujari", title: t("auth.pujari"), desc: t("home.pujariBlurb"), icon: UserCheck, href: "/pujari" },
              ].map((card) => (
                <Card key={card.role} className="border-border shadow-sm">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                      <card.icon size={24} aria-hidden />
                    </div>
                    <CardTitle>{card.title}</CardTitle>
                    <CardDescription>{card.desc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {user?.role === card.role ? (
                      <Link href={dashboardPath(card.role)}>
                        <Button className="w-full">{t("home.goDashboard")}</Button>
                      </Link>
                    ) : user ? (
                      <Button className="w-full" variant="outline" disabled>
                        {t("home.signedInAs", { role: user.role })}
                      </Button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Link href={card.href}>
                          <Button className="w-full">{t("auth.signIn")}</Button>
                        </Link>
                        <Link href={`/register?role=${card.role}`}>
                          <Button variant="outline" className="w-full">{t("auth.register")}</Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}
    </Layout>
  );
}
