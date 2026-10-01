import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import ServiceCard from "@/components/ServiceCard";
import { Button } from "@/components/ui/button";
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
import { api } from "@/lib/api";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LandingHeroBackground from "@/components/LandingHeroBackground";

const PUJARI_REGISTER = "/register?role=pujari";
/** Number of cards shown in the Featured Pujas section. */
const FEATURED_PUJAS_LIMIT = 8;

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
      .then((rows) => setPopular((rows || []).slice(0, FEATURED_PUJAS_LIMIT)))
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

  const clientHowSteps = [
    { icon: Search, title: t("home.clientStep1Title"), desc: t("home.clientStep1Desc") },
    { icon: ClipboardList, title: t("home.clientStep2Title"), desc: t("home.clientStep2Desc") },
    { icon: UserCheck, title: t("home.clientStep3Title"), desc: t("home.clientStep3Desc") },
    { icon: CalendarCheck, title: t("home.clientStep4Title"), desc: t("home.clientStep4Desc") },
    { icon: Heart, title: t("home.clientStep5Title"), desc: t("home.clientStep5Desc") },
  ];

  const pujariHowSteps = [
    { icon: UserCheck, title: t("home.pujariStep1Title"), desc: t("home.pujariStep1Desc") },
    { icon: Search, title: t("home.pujariStep2Title"), desc: t("home.pujariStep2Desc") },
    { icon: ClipboardList, title: t("home.pujariStep3Title"), desc: t("home.pujariStep3Desc") },
    { icon: Bell, title: t("home.pujariStep4Title"), desc: t("home.pujariStep4Desc") },
    { icon: Sparkles, title: t("home.pujariStep5Title"), desc: t("home.pujariStep5Desc") },
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
      <section className="relative min-h-[72vh] sm:min-h-[78vh] lg:min-h-[85vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <LandingHeroBackground />
        </div>

        <div className="container relative z-10 w-full py-10 sm:py-12 md:py-14 lg:py-16">
          <div className="mx-auto flex w-full flex-col items-center text-center animate-in fade-in duration-700 motion-reduce:animate-none">
            <span className="inline-flex w-fit max-w-[calc(100%-0.5rem)] items-center justify-center rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[0.625rem] font-bold uppercase leading-snug tracking-[0.12em] text-[#FFFFFF] backdrop-blur-sm sm:max-w-full sm:px-4 sm:text-[0.6875rem] sm:tracking-[0.14em] md:text-xs md:tracking-widest">
              {t("home.badge")}
            </span>

            <h1 className="mt-4 w-full max-w-[62.5rem] text-balance text-[clamp(1.75rem,3.8vw+0.75rem,3.125rem)] font-bold leading-[1.12] tracking-tight text-brand-orange sm:mt-5 md:mt-6">
              {t("home.heroTitle1")}
            </h1>

            <p className="mt-4 w-full max-w-[52.5rem] text-base font-medium leading-relaxed text-[#FFFFFF] sm:mt-5 sm:text-lg md:mt-6 md:leading-[1.65]">
              {t("home.heroDesc")}
            </p>

            <div className="mt-5 flex w-full max-w-md flex-col gap-3 sm:mt-8 sm:max-w-none sm:w-auto sm:flex-row sm:justify-center md:mt-8">
              <Button
                size="lg"
                className="h-12 w-full min-h-12 px-8 bg-primary text-primary-foreground font-bold shadow-lg sm:w-auto sm:min-w-[11rem]"
                onClick={() => setLocation("/services")}
              >
                {t("home.exploreServices")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 w-full min-h-12 border-white/50 bg-white/10 px-8 font-semibold text-[#FFFFFF] hover:bg-white/20 hover:text-[#FFFFFF] sm:w-auto sm:min-w-[11rem]"
                onClick={() => setLocation(PUJARI_REGISTER)}
              >
                {t("home.joinAsPujari")}
              </Button>
            </div>

            <div className="mt-8 w-full max-w-[52.5rem] rounded-xl bg-card p-2.5 shadow-2xl sm:p-3 md:mt-10">
              <div className="flex w-full flex-col gap-2 sm:gap-2.5 md:flex-row md:items-stretch">
                <div className="w-full md:w-[10.5rem] md:shrink-0 lg:w-[11.5rem] xl:w-[12.5rem]">
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
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground stroke-[2.5]" size={20} aria-hidden />
                  <Input
                    value={heroQ}
                    onChange={(e) => setHeroQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && goSearch()}
                    placeholder={t("services.searchPujas")}
                    aria-label={t("home.whatPlanning")}
                    className="h-12 w-full pl-10 border-none bg-secondary/30 focus-visible:ring-0 font-bold text-foreground placeholder:font-semibold placeholder:text-muted-foreground"
                  />
                </div>
                <Button className="h-12 w-full shrink-0 bg-primary px-8 font-bold text-white md:w-auto md:min-w-[7.5rem]" onClick={goSearch}>
                  {t("common.search")}
                </Button>
              </div>
            </div>

            <p className="mt-3 max-w-[32rem] text-xs font-semibold leading-relaxed text-[#FFFFFF] sm:mt-4 sm:text-sm md:max-w-[36rem]">
              {t("home.searchHint")}
            </p>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-16 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="container relative z-10">
          <h2 className="landing-doc-heading mx-auto mb-8 max-w-[58rem] text-center md:mb-10">
            {t("home.twoSidedTitle")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {valuePillars.map((pillar) => (
              <div
                key={pillar.eyebrow}
                className="card-hover-premium flex h-full flex-col items-center p-6 text-center rounded-2xl border border-border/60 bg-card/50 shadow-sm sm:p-7"
              >
                <div className="mb-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <pillar.icon size={28} aria-hidden />
                </div>
                <h3 className="landing-doc-card-title mb-2">{pillar.title}</h3>
                <p className="landing-doc-card-body">{pillar.desc}</p>
              </div>
            ))}
          </div>
          {t("home.valueBody") ? (
            <p className="landing-doc-body mt-8 text-center landing-doc-prose">
              {t("home.valueBody")}
            </p>
          ) : null}
        </div>
      </section>

      <section className="py-14 md:py-20 relative overflow-hidden bg-secondary/15">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="absolute -top-4 -left-4 w-24 h-24 border-t-4 border-l-4 border-primary rounded-tl-3xl" />
              <div className="absolute -bottom-4 -right-4 w-24 h-24 border-b-4 border-r-4 border-primary rounded-br-3xl" />
              <img
                src="/images/temple-ritual.png"
                alt={t("home.missionImageAlt")}
                className="rounded-2xl shadow-2xl w-full object-cover aspect-[4/3]"
              />
            </div>
            <div className="order-1 lg:order-2 text-center lg:text-left">
              <h2 className="landing-doc-heading mb-5 md:mb-6">{t("home.providerTitle")}</h2>
              <div className="landing-doc-prose landing-doc-body mb-6 sm:mb-8 lg:mx-0">
                <p>{t("home.providerP1")}</p>
                <p>{t("home.providerP2")}</p>
                <p>{t("home.providerP3")}</p>
              </div>
              <Button
                className="h-12 w-full sm:w-auto bg-sidebar px-8 text-sidebar-foreground hover:bg-sidebar/90"
                onClick={() => setLocation(PUJARI_REGISTER)}
              >
                {t("home.providerCta")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-12 md:py-16 bg-background scroll-mt-20">
        <div className="container">
          <SectionHeader variant="landingDoc" title={t("home.howItWorksTitle")} />
          <Tabs defaultValue="clients" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8 h-auto">
              <TabsTrigger value="clients" className="py-3 text-sm md:text-base">
                {t("home.howClientsTab")}
              </TabsTrigger>
              <TabsTrigger value="pujaris" className="py-3 text-sm md:text-base">
                {t("home.howPujarisTab")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="clients" className="mt-0">
              <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                {clientHowSteps.map((step, i) => (
                  <li
                    key={step.title}
                    className="card-hover-premium rounded-xl border border-border/60 bg-card p-4 md:p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <step.icon size={18} aria-hidden />
                      </span>
                      <span className="text-xs font-bold tracking-widest uppercase text-primary">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="landing-doc-card-title mb-1.5">{step.title}</h3>
                    <p className="landing-doc-card-body">{step.desc}</p>
                  </li>
                ))}
              </ol>
            </TabsContent>
            <TabsContent value="pujaris" className="mt-0">
              <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                {pujariHowSteps.map((step, i) => (
                  <li
                    key={step.title}
                    className="card-hover-premium rounded-xl border border-border/60 bg-card p-4 md:p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <step.icon size={18} aria-hidden />
                      </span>
                      <span className="text-xs font-bold tracking-widest uppercase text-primary">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="landing-doc-card-title mb-1.5">{step.title}</h3>
                    <p className="landing-doc-card-body">{step.desc}</p>
                  </li>
                ))}
              </ol>
            </TabsContent>
          </Tabs>
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

            <div className="relative z-10 mx-auto w-full max-w-[58rem] px-1">
              <h2 className="landing-doc-heading text-foreground mb-5 md:mb-6">{t("home.ctaTitle")}</h2>
              <p className="landing-doc-copy mb-6 text-foreground md:mb-8">{t("home.ctaDesc")}</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
                <Button
                  size="lg"
                  className="h-12 w-full min-h-12 bg-sidebar px-8 text-base text-white shadow-lg hover:bg-sidebar/90 sm:h-14 sm:w-auto sm:min-w-[11rem] sm:px-10 sm:text-lg"
                  onClick={() => setLocation("/services")}
                >
                  {t("home.bookNow")}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 w-full min-h-12 border-2 border-sidebar bg-transparent px-8 text-base font-bold text-foreground hover:bg-sidebar/10 sm:h-14 sm:w-auto sm:min-w-[11rem] sm:px-10 sm:text-lg"
                  onClick={() => setLocation(PUJARI_REGISTER)}
                >
                  {t("home.joinAsPujari")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!user && (
        <section className="py-14 bg-secondary/10">
          <div className="container mx-auto max-w-3xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button className="h-12 w-full min-h-12 px-8 sm:w-auto" onClick={() => setLocation(PUJARI_REGISTER)}>
                {t("home.pujariPartnerCta")}
              </Button>
              <Link href="/pujari" className="w-full sm:w-auto">
                <Button variant="outline" className="h-12 w-full min-h-12 px-8 sm:w-auto">
                  {t("auth.signIn")}
                </Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground mt-6 leading-relaxed">{t("home.pujariPartnerNote")}</p>
          </div>
        </section>
      )}
    </Layout>
  );
}
