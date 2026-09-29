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
 *
 * Data comes from `GET /services?q=&category=` so the original Explore visibility rules apply
 * (active + priced, or awaiting pricing). That endpoint also returns Chadhava and Pravachan rows,
 * so results are restricted to Puja here.
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

  // Keep ?q= in the address bar so a reload or shared link restores the search.
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
    [categories, t]
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

  const renderGrid = (list: CatalogService[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
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
            className="cursor-pointer min-w-0 h-full flex"
          >
            <ServiceCard
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

  return (
    <div className="space-y-6" data-testid="puja-discovery">
      <div className="max-w-xl relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          size={18}
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("services.searchPujas")}
          aria-label={t("services.searchPujas")}
          className="h-12 pl-11 bg-card text-foreground"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin" role="group" aria-label={t("services.title")}>
        {chips.map((c) => (
          <button
            key={c.slug}
            type="button"
            aria-pressed={category === c.slug}
            onClick={() => selectCategory(c.slug)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
              category === c.slug
                ? "bg-primary text-white border-primary"
                : "bg-card text-foreground border-border hover:border-primary/40"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : pujas.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">{t("services.noPujas")}</p>
      ) : (
        <div className="space-y-10">
          {pageAvailable.length > 0 && (
            <div>
              <h2 className="text-h3 text-foreground mb-4">{t("services.availablePujas")}</h2>
              {renderGrid(pageAvailable)}
            </div>
          )}
          {pageUpcoming.length > 0 && (
            <div>
              <h2 className="text-h3 text-foreground mb-2">{t("services.upcomingServices")}</h2>
              <p className="text-sm text-muted-foreground mb-4">{t("services.upcomingDescription")}</p>
              {renderGrid(pageUpcoming)}
            </div>
          )}
          {paginate ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{t("services.show")}</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-9 rounded-md border border-border bg-card px-2 text-foreground"
                  aria-label={t("services.itemsPerPage")}
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span>{t("services.perPageTotal", { count: combined.length })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t("services.previous")}
                </Button>
                <span className="text-sm text-muted-foreground tabular-nums px-2">
                  {t("services.pageOf", { page: pageSafe, pages: totalPages })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t("common.next")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
