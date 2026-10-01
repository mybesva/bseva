import { useEffect, useMemo, useState } from "react";
import { Flame, Flower, Heart, Home, Loader2, Moon, Search, Sparkles, Star, Sun } from "lucide-react";
import ServiceCard from "@/components/ServiceCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import { serviceImageUrl } from "@/lib/serviceImage";
import { formatStartingFrom } from "@/lib/servicePricing";
import { useStartBooking } from "@/hooks/useStartBooking";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";
import {
  buildServicesApiQuery,
  buildServicesSearch,
  pujaServicesOnly,
  splitAvailableUpcoming,
} from "@bseva/config";
import type { CatalogService, ServiceCategory } from "@bseva/types";

const ICONS = [Flower, Home, Flame, Heart, Sun, Star, Moon, Sparkles];
const PAGE_SIZES = [6, 9, 12, 24];
const URL_SYNC_DELAY_MS = 300;

/**
 * Puja Seva pane: the complete Explore Services discovery experience (server-side search, All /
 * Popular / category chips, Available vs Upcoming, pagination, Read More, Book Now).
 */
export default function PujaDiscovery() {
  const { t, lang } = useI18n();
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const { startBooking, bookingBlocked, checking } = useStartBooking();

  const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const category = params.get("category") || "all";
  const [q, setQ] = useState(params.get("q") || "");

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  useEffect(() => {
    api<ServiceCategory[]>("/service-categories")
      .then((rows) => setCategories(Array.isArray(rows) ? rows : []))
      .catch(() => setCategories([]));
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams(buildServicesApiQuery({ q, category }));
    setLoading(true);
    setPage(1);
    api<CatalogService[]>(`/services${qs.toString() ? `?${qs}` : ""}`)
      .then((rows) => {
        if (!cancelled) setServices(Array.isArray(rows) ? rows : []);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setServices([]);
        toast.error(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, category, lang]);

  useEffect(() => {
    const next = buildServicesSearch({ q, category });
    const current = searchStr ? `?${searchStr}` : "";
    if (next === current) return;
    const timer = window.setTimeout(() => setLocation(`/services${next}`, { replace: true }), URL_SYNC_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [q, category, searchStr, setLocation]);

  function openDetails(slug: string) {
    setLocation(`/services/${slug}`);
  }

  function selectCategory(slug: string) {
    setLocation(`/services${buildServicesSearch({ q, category: slug })}`);
  }

  const chips = useMemo(
    () => [
      { slug: "all", name: t("common.all") },
      { slug: "popular", name: t("services.popular") },
      ...categories.map((c) => ({ slug: c.slug, name: c.name })),
    ],
    [categories, t],
  );

  const pujas = useMemo(() => pujaServicesOnly(services), [services]);
  const { combined } = useMemo(() => splitAvailableUpcoming(pujas), [pujas]);
  const paginate = category === "all";
  const totalPages = Math.max(1, Math.ceil(combined.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const visible = useMemo(() => {
    if (!paginate) return combined;
    const start = (pageSafe - 1) * pageSize;
    return combined.slice(start, start + pageSize);
  }, [combined, paginate, pageSafe, pageSize]);
  const pageAvailable = visible.filter((s) => s.bookable);
  const pageUpcoming = visible.filter((s) => !s.bookable);

  const sectionTitle = useMemo(() => {
    const trimmedQ = q.trim();
    if (trimmedQ) return t("sv.grid.titleSearch");
    if (category === "popular") return t("sv.grid.titlePopular");
    if (category === "all") return t("sv.grid.titleAll");
    const chip = chips.find((c) => c.slug === category);
    if (chip) return t("sv.grid.titleCategory", { name: chip.name });
    return t("sv.grid.titleAll");
  }, [q, category, chips, t]);

  const renderGrid = (list: CatalogService[]) => (
    <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 md:gap-7 lg:grid-cols-3 lg:gap-8">
      {list.map((s, i) => {
        const Icon = ICONS[i % ICONS.length];
        const starting = formatStartingFrom(s, lang);
        const desc =
          s.short_description ||
          s.description ||
          starting ||
          (s.bookable ? t("services.pricingSoon") : t("services.comingSoonLabel"));
        return (
          <div
            key={s.id}
            onClick={() => openDetails(s.slug)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDetails(s.slug);
              }
            }}
            role="link"
            tabIndex={0}
            className="flex h-full min-w-0 cursor-pointer"
          >
            <ServiceCard
              variant="explore"
              title={s.name}
              description={desc}
              startingFrom={starting}
              image={serviceImageUrl(s)}
              icon={<Icon size={20} />}
              comingSoon={!s.bookable}
              bookingDisabled={Boolean(s.bookable && bookingBlocked)}
              bookingDisabledLabel={
                checking ? t("services.checkingAvailability") : t("services.bookingUnavailableArea")
              }
              onReadMore={() => openDetails(s.slug)}
              onBookNow={() => startBooking(s.slug)}
            />
          </div>
        );
      })}
    </div>
  );

  const paginationBar =
    paginate && !loading && pujas.length > 0 ? (
      <div className="flex flex-col items-center justify-between gap-3 border-t border-primary/10 pt-5 sm:flex-row">
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-foreground/80 sm:justify-start">
          <span>{t("services.show")}</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-9 rounded-md border border-primary/20 bg-card px-2 font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={t("services.itemsPerPage")}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="tabular-nums">{t("services.perPageTotal", { count: combined.length })}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageSafe <= 1}
            className="min-w-[5.5rem] border-primary/25 font-semibold disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("services.previous")}
          </Button>
          <span className="px-2 text-sm font-medium tabular-nums text-foreground">
            {t("services.pageOf", { page: pageSafe, pages: totalPages })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageSafe >= totalPages}
            className="min-w-[5.5rem] border-primary/25 font-semibold disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {t("common.next")}
          </Button>
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-6" data-testid="puja-discovery">
      <div className="relative mx-auto w-full max-w-3xl">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("services.searchPujas")}
          aria-label={t("services.searchPujas")}
          className="h-12 border-primary/15 bg-card pl-11 text-base shadow-sm focus-visible:border-primary focus-visible:ring-primary/30 dark:bg-card"
        />
      </div>

      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin"
        role="group"
        aria-label={t("services.title")}
      >
        {chips.map((c) => (
          <button
            key={c.slug}
            type="button"
            aria-pressed={category === c.slug}
            onClick={() => selectCategory(c.slug)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
              category === c.slug
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-primary/35 bg-card text-[#0A1630] hover:border-primary/60 hover:bg-primary/5 dark:text-foreground"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <header className="pt-2 text-center md:pt-4">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">{t("sv.grid.eyebrow")}</p>
        <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-[#0A1630] dark:text-foreground md:text-3xl">
          {sectionTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-foreground/85">{t("sv.grid.desc")}</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : pujas.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">{t("services.noPujas")}</p>
      ) : (
        <div className="space-y-8">
          {pageAvailable.length > 0 && (
            <div className="space-y-6">
              {pageUpcoming.length > 0 ? (
                <h3 className="sr-only">{t("services.availablePujas")}</h3>
              ) : null}
              {renderGrid(pageAvailable)}
            </div>
          )}
          {pageUpcoming.length > 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">{t("services.upcomingServices")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("services.upcomingDescription")}</p>
              </div>
              {renderGrid(pageUpcoming)}
            </div>
          )}
          {paginationBar}
        </div>
      )}
    </div>
  );
}
