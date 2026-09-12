import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import ServiceCard from "@/components/ServiceCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flame, Flower, Home, Sparkles, Heart, Star, Sun, Moon, Loader2, Search } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useLocation, useSearch } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { serviceImageUrl } from "@/lib/serviceImage";

const ICONS = [Flower, Home, Flame, Heart, Sun, Star, Moon, Sparkles];

type Cat = { id: string; slug: string; name: string; service_count?: number };
type Svc = {
  id: string;
  name: string;
  slug: string;
  short_description?: string;
  description?: string;
  standard_price_paise?: number | null;
  bookable?: boolean;
  active?: boolean;
  image_url?: string | null;
  image_path?: string | null;
  categories?: { slug: string; name: string }[];
};

export default function Services() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [services, setServices] = useState<Svc[]>([]);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const [q, setQ] = useState(params.get("q") || "");
  const [category, setCategory] = useState(params.get("category") || "all");

  useEffect(() => {
    api<Cat[]>("/service-categories")
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (q.trim()) qs.set("q", q.trim());
    if (category && category !== "all") qs.set("category", category);
    setLoading(true);
    api<Svc[]>(`/services?${qs}`)
      .then(setServices)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [q, category]);

  function openService(slug: string, bookable?: boolean) {
    if (!bookable) {
      setLocation(`/services/${slug}`);
      return;
    }
    const path = `/book/${slug}`;
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== "customer") {
      setLocation(getLoginUrl({ role: "customer", returnPath: path }));
      return;
    }
    setLocation(path);
  }

  function selectCategory(slug: string) {
    setCategory(slug);
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (slug && slug !== "all") next.set("category", slug);
    const s = next.toString();
    setLocation(s ? `/services?${s}` : "/services");
  }

  const chips = useMemo(
    () => [{ slug: "all", name: "All" }, { slug: "popular", name: "Popular" }, ...categories.map((c) => ({ slug: c.slug, name: c.name }))],
    [categories]
  );

  return (
    <Layout>
      <section className="relative py-16 md:py-20 bg-sidebar text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="container relative z-10 text-center">
          <h1 className="text-display text-primary mb-4">{t("services.title")}</h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">{t("services.subtitle")}</p>
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Pujas, Homams, Vrathams..."
              className="h-12 pl-11 bg-card text-foreground border-none shadow-lg"
            />
          </div>
        </div>
      </section>

      <section className="py-10 md:py-14">
        <div className="container">
          <div className="flex gap-2 overflow-x-auto pb-4 mb-8 -mx-1 px-1 scrollbar-thin">
            {chips.map((c) => (
              <button
                key={c.slug}
                type="button"
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
          ) : services.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">No pujas match your search.</p>
          ) : (
            <div className="space-y-10">
              {(() => {
                const available = services.filter((s) => s.bookable);
                const upcoming = services.filter((s) => !s.bookable);
                const renderGrid = (list: Svc[]) => (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {list.map((s, i) => {
                      const Icon = ICONS[i % ICONS.length];
                      const img = serviceImageUrl(s);
                      const desc =
                        s.short_description ||
                        s.description ||
                        (s.bookable && s.standard_price_paise != null
                          ? `From ₹${(s.standard_price_paise / 100).toLocaleString("en-IN")}`
                          : "Pricing set by Admin soon");
                      return (
                        <div key={s.id} onClick={() => openService(s.slug, s.bookable)} className="cursor-pointer">
                          <ServiceCard
                            title={s.name}
                            description={desc}
                            image={img}
                            icon={<Icon size={24} />}
                            comingSoon={!s.bookable}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
                return (
                  <>
                    {available.length > 0 && (
                      <div>
                        <h2 className="text-h3 text-foreground mb-4">Available pujas</h2>
                        {renderGrid(available)}
                      </div>
                    )}
                    {upcoming.length > 0 && (
                      <div>
                        <h2 className="text-h3 text-foreground mb-2">Upcoming services</h2>
                        <p className="text-sm text-muted-foreground mb-4">
                          These pujas are listed as <span className="font-semibold text-amber-600">Coming Soon</span> and will open for booking when Admin marks them Available.
                        </p>
                        {renderGrid(upcoming)}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </section>

      <section className="py-16 bg-secondary/20">
        <div className="container text-center">
          <SectionHeader title={t("services.customTitle")} description={t("services.customDesc")} />
          <Button
            size="lg"
            className="bg-primary text-white hover:bg-primary/90 px-8 h-12 text-lg font-bold shadow-lg"
            onClick={() => setLocation("/contact")}
          >
            {t("services.requestCustom")}
          </Button>
        </div>
      </section>
    </Layout>
  );
}
