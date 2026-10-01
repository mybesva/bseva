import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Search } from "lucide-react";
import { buildServicesSearch } from "@bseva/config";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/i18n/I18nProvider";
import { CATEGORY_CARD_IMAGES, CATEGORY_PREFERENCE } from "@/lib/landingConfig";

const CITIES: { value: string; labelKey?: string; label?: string }[] = [
  { value: "all", labelKey: "home.allCities" },
  { value: "Bangalore", label: "Bangalore" },
  { value: "Hyderabad", label: "Hyderabad" },
  { value: "Mumbai", label: "Mumbai" },
  { value: "Delhi", label: "Delhi" },
  { value: "Chennai", label: "Chennai" },
];

/** Subset of GET /service-categories used by the landing page. */
export type LandingCategory = {
  slug: string;
  name: string;
  description?: string | null;
  service_count?: number;
  active?: boolean;
};

type Card = { key: string; href: string; title: string; desc: string; image: string };

type Props = {
  categories: LandingCategory[];
  loading: boolean;
};

/**
 * "Puja Services for Every Occasion". All Pujas and Popular Pujas are the existing virtual filters;
 * the remaining cards are real service categories from GET /service-categories (never invented).
 */
export default function LandingServices({ categories, loading }: Props) {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");

  const cards = useMemo<Card[]>(() => {
    const live = categories.filter((c) => c.active !== false && (c.service_count ?? 1) > 0);
    const preferred = CATEGORY_PREFERENCE.map((slug) => live.find((c) => c.slug === slug)).filter(
      (c): c is LandingCategory => Boolean(c),
    );
    const rest = live.filter((c) => !preferred.includes(c));
    const picked = [...preferred, ...rest].slice(0, 4);
    return [
      {
        key: "all",
        href: "/services",
        title: t("lp.svc.allPujas"),
        desc: t("lp.svc.allPujasDesc"),
        image: CATEGORY_CARD_IMAGES.all,
      },
      {
        key: "popular",
        href: `/services${buildServicesSearch({ category: "popular" })}`,
        title: t("lp.svc.popular"),
        desc: t("lp.svc.popularDesc"),
        image: CATEGORY_CARD_IMAGES.popular,
      },
      ...picked.map((c) => ({
        key: c.slug,
        href: `/services${buildServicesSearch({ category: c.slug })}`,
        title: c.name,
        desc: c.description?.trim() || t("lp.svc.count", { count: c.service_count ?? 0 }),
        image: CATEGORY_CARD_IMAGES[c.slug] ?? CATEGORY_CARD_IMAGES.all,
      })),
    ];
  }, [categories, t]);

  function goSearch() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (city) params.set("city", city);
    const s = params.toString();
    setLocation(s ? `/services?${s}` : "/services");
  }

  return (
    <section id="popular-pujas" aria-labelledby="lp-services-title" className="scroll-mt-24 bg-background py-14 md:py-20">
      <div className="container">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="lp-orange-ink text-xs font-bold uppercase tracking-[0.2em]">{t("lp.svc.eyebrow")}</p>
            <h2
              id="lp-services-title"
              className="mt-2 text-balance font-display text-3xl font-bold leading-tight text-foreground md:text-4xl"
            >
              {t("lp.svc.title")}
            </h2>
            <p className="mt-3 text-base font-medium leading-relaxed text-foreground md:text-lg">{t("lp.svc.desc")}</p>
          </div>
          <Link href="/services">
            <a className="group lp-orange-ink inline-flex shrink-0 items-center gap-2 self-start rounded-md py-2 text-base font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:self-auto">
              {t("lp.svc.viewAll")}
              <ArrowRight size={18} aria-hidden className="lp-arrow" />
            </a>
          </Link>
        </div>

        {/* Existing hero search + city filter, relocated here. */}
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            goSearch();
          }}
          className="mt-7 flex w-full flex-col gap-2 rounded-xl border border-border/60 bg-card p-2 shadow-sm sm:flex-row sm:items-stretch lg:max-w-3xl"
        >
          <div className="w-full sm:w-44 sm:shrink-0">
            <Select value={city || "all"} onValueChange={(v) => setCity(v === "all" ? "" : v)}>
              <SelectTrigger
                aria-label={t("home.whereTakePlace")}
                className="h-11 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm font-bold text-foreground"
              >
                <SelectValue placeholder={t("home.whereTakePlace")} />
              </SelectTrigger>
              <SelectContent className="border-primary/30 bg-card shadow-lg">
                {CITIES.map((c) => (
                  <SelectItem key={c.value} value={c.value} className="font-bold text-foreground">
                    {c.labelKey ? t(c.labelKey) : (c.label ?? c.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground"
              size={18}
              aria-hidden
            />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("services.searchPujas")}
              aria-label={t("home.whatPlanning")}
              className="h-11 w-full border-none bg-secondary/30 pl-10 font-semibold text-foreground placeholder:text-muted-foreground focus-visible:ring-2"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {t("common.search")}
          </button>
        </form>

        <div
          className="lp-swipe -mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-6"
          role="list"
          aria-label={t("lp.svc.title")}
        >
          {loading
            ? Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  role="listitem"
                  aria-hidden
                  className="w-[62%] shrink-0 snap-start animate-pulse rounded-2xl border border-border/50 bg-card min-[480px]:w-[42%] md:w-auto"
                >
                  <div className="aspect-[4/3] rounded-t-2xl bg-muted" />
                  <div className="space-y-2 p-4">
                    <div className="h-4 w-2/3 rounded bg-muted" />
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="mt-4 h-8 w-8 rounded-full bg-muted" />
                  </div>
                </div>
              ))
            : cards.map((card) => (
                <div
                  key={card.key}
                  role="listitem"
                  className="w-[62%] shrink-0 snap-start min-[480px]:w-[42%] md:w-auto"
                >
                  <Link href={card.href}>
                    <a
                      aria-label={t("lp.svc.open", { name: card.title })}
                      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-muted">
                        <img
                          src={card.image}
                          alt=""
                          width={560}
                          height={420}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <h3 className="text-base font-bold leading-snug text-foreground">{card.title}</h3>
                        <p className="mt-1 text-sm font-medium leading-snug text-muted-foreground">{card.desc}</p>
                        <div className="mt-auto pt-4">
                          <span
                            aria-hidden
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-300 group-hover:translate-x-1"
                          >
                            <ArrowRight size={16} />
                          </span>
                        </div>
                      </div>
                    </a>
                  </Link>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
