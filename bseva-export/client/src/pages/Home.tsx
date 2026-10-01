import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { enabledSevaServiceTypes, type SevaConfigFlags } from "@bseva/config";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import { LANDING_TESTIMONIALS, PREVIEW_TESTIMONIALS } from "@/lib/landingConfig";
import LandingHero from "@/components/landing/LandingHero";
import LandingServices, { type LandingCategory } from "@/components/landing/LandingServices";
import LandingHowItWorks from "@/components/landing/LandingHowItWorks";
import LandingImpact from "@/components/landing/LandingImpact";
import LandingAudience from "@/components/landing/LandingAudience";
import LandingAppShowcase from "@/components/landing/LandingAppShowcase";
import LandingTestimonials from "@/components/landing/LandingTestimonials";
import LandingFinalCta from "@/components/landing/LandingFinalCta";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Public landing page. Section components live in `components/landing/*`;
 * this page owns data loading (service categories, Seva config) and page-level behaviour
 * (document meta, deep-link scrolling).
 */
export default function Home() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const search = useSearch();

  const [categories, setCategories] = useState<LandingCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [sevaConfig, setSevaConfig] = useState<SevaConfigFlags | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingCategories(true);
    api<LandingCategory[]>("/service-categories")
      .then((rows) => {
        if (!cancelled) setCategories(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCategories(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  useEffect(() => {
    api<SevaConfigFlags>("/seva/config")
      .then(setSevaConfig)
      .catch(() => setSevaConfig(null));
  }, []);

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

  const sevaTypeCount = useMemo(() => (sevaConfig ? enabledSevaServiceTypes(sevaConfig).length : 0), [sevaConfig]);

  const testimonials = useMemo(() => {
    if (LANDING_TESTIMONIALS.length) return LANDING_TESTIMONIALS;
    // Dev-only visual QA hook; never active in production builds.
    if (import.meta.env.DEV && new URLSearchParams(search).get("previewTestimonials") === "1") {
      return PREVIEW_TESTIMONIALS;
    }
    return [];
  }, [search]);

  const liveCategories = useMemo(() => categories.filter((c) => c.active !== false), [categories]);

  return (
    <Layout>
      <LandingHero />
      <LandingServices categories={liveCategories} loading={loadingCategories} />
      <LandingHowItWorks />
      <LandingImpact categoryCount={liveCategories.length} sevaTypeCount={sevaTypeCount} />
      <LandingAudience />
      {!user ? (
        <p className="container -mt-6 pb-12 text-center text-xs font-medium leading-relaxed text-muted-foreground md:-mt-10">
          <span className="mx-auto block max-w-3xl">{t("home.pujariPartnerNote")}</span>
        </p>
      ) : null}
      <LandingAppShowcase categories={liveCategories} />
      <LandingTestimonials items={testimonials} />
      <LandingFinalCta />
    </Layout>
  );
}
