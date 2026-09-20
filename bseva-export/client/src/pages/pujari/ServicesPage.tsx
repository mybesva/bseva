import { useEffect, useMemo, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import PujariOnboardingWalkthrough, { usePujariOnboardingGate } from "@/components/PujariOnboardingWalkthrough";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, rupees } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { PujaTitle } from "@/components/PujaTitle";

type CatalogService = {
  id: string;
  name: string;
  slug: string;
  short_description?: string | null;
  catalog_price_paise: number;
  dakshina_paise: number;
  applied: boolean;
  section_slugs?: string[];
  categories?: { slug?: string; name?: string }[];
};

type Section = { slug: string; name: string };

type OffersPayload = {
  share_percent: number;
  services: CatalogService[];
  sections?: Section[];
  applied_count: number;
  note?: string;
};

export default function PujariServicesPage() {
  const { t } = useI18n();
  const { active: onboardingActive } = usePujariOnboardingGate("services");
  const [walkthroughErrors, setWalkthroughErrors] = useState<Record<string, string>>({});
  const [data, setData] = useState<OffersPayload | null>(null);
  const [q, setQ] = useState("");
  const [section, setSection] = useState("all");
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const out = await api<OffersPayload>("/pujari/service-offers");
      setData(out);
      setSection("all");
    } catch (e: any) {
      const msg = e?.message || t("web.services.loadFailed");
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function applyForService(serviceId: string) {
    setApplyingId(serviceId);
    try {
      const out = await api<OffersPayload>("/pujari/service-offers/apply", {
        method: "POST",
        body: JSON.stringify({ service_id: serviceId }),
      });
      setData(out);
      if (!onboardingActive) toast.success(t("web.services.applied"));
    } catch (err: any) {
      toast.error(err.message || t("web.services.applyFailed"));
    } finally {
      setApplyingId(null);
    }
  }

  async function persistServiceSelection(): Promise<boolean> {
    const count = data?.applied_count ?? data?.services.filter((s) => s.applied).length ?? 0;
    if (count === 0) {
      toast.error(t("web.services.applyOne"));
      return false;
    }
    return true;
  }

  const sections = useMemo(() => {
    const fromApi = data?.sections || [{ slug: "all", name: "All" }];
    if (!fromApi.some((s) => s.slug === "all")) {
      return [{ slug: "all", name: "All" }, ...fromApi];
    }
    return fromApi;
  }, [data]);

  const filtered = useMemo(() => {
    const services = data?.services || [];
    const needle = q.trim().toLowerCase();
    return services.filter((s) => {
      if (section !== "all") {
        const slugs = s.section_slugs || [];
        if (!slugs.includes(section)) return false;
      }
      if (!needle) return true;
      return (
        s.name.toLowerCase().includes(needle) ||
        (s.short_description || "").toLowerCase().includes(needle) ||
        (s.slug || "").toLowerCase().includes(needle)
      );
    });
  }, [data, q, section]);

  const grouped = useMemo(() => {
    if (section !== "all") {
      const title = sections.find((s) => s.slug === section)?.name || section;
      return [{ slug: section, name: title, items: filtered }];
    }
    const bySlug = new Map<string, { slug: string; name: string; items: CatalogService[] }>();
    const uncategorized: CatalogService[] = [];
    for (const s of filtered) {
      const cats = s.categories || [];
      if (!cats.length) {
        uncategorized.push(s);
        continue;
      }
      for (const c of cats) {
        const slug = c.slug || "other";
        const name = c.name || slug;
        if (!bySlug.has(slug)) bySlug.set(slug, { slug, name, items: [] });
        const bucket = bySlug.get(slug)!;
        if (!bucket.items.some((x) => x.id === s.id)) bucket.items.push(s);
      }
    }
    const ordered: { slug: string; name: string; items: CatalogService[] }[] = [];
    for (const sec of sections) {
      if (sec.slug === "all") continue;
      const bucket = bySlug.get(sec.slug);
      if (bucket?.items.length) ordered.push(bucket);
      bySlug.delete(sec.slug);
    }
    for (const bucket of bySlug.values()) {
      if (bucket.items.length) ordered.push(bucket);
    }
    if (uncategorized.length) {
      ordered.push({ slug: "uncategorized", name: t("web.services.otherPujas"), items: uncategorized });
    }
    return ordered.length ? ordered : [{ slug: "all", name: t("web.services.allPujas"), items: filtered }];
  }, [filtered, section, sections, t]);

  if (loading && !data) {
    return (
      <PujariPortal>
        <p className="text-muted-foreground">{t("web.services.loading")}</p>
      </PujariPortal>
    );
  }

  if (loadError && !data) {
    return (
      <PujariPortal>
        <Card className="max-w-lg border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">{t("web.services.loadFailed")}</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => void load()}>
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      </PujariPortal>
    );
  }

  if (!data) {
    return (
      <PujariPortal>
        <p className="text-muted-foreground">{t("web.services.loading")}</p>
      </PujariPortal>
    );
  }

  const appliedCount = data.applied_count ?? data.services.filter((s) => s.applied).length;

  return (
    <PujariPortal>
      <div className="w-full max-w-none space-y-6">
        <div className="sticky top-14 z-30 -mx-4 lg:-mx-8 px-4 lg:px-8 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
          <div className="min-w-0">
            <h1 className="text-h1 truncate">{t("web.services.title")}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {appliedCount > 0
                ? t("web.services.appliedCount", { count: appliedCount })
                : t("web.services.catalogCount", { count: data.services.length })}
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{data.note}</p>
        {walkthroughErrors.services ? (
          <p className="text-sm text-red-600 font-medium">{walkthroughErrors.services}</p>
        ) : null}

        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("web.services.search")}
          className="max-w-md bg-background"
        />

        <div className="flex flex-wrap gap-2">
          {sections.map((sec) => (
            <Button
              key={sec.slug}
              type="button"
              size="sm"
              variant={section === sec.slug ? "default" : "outline"}
              onClick={() => setSection(sec.slug)}
            >
              {sec.name}
            </Button>
          ))}
        </div>

        <div className="space-y-8 pb-8">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t("web.services.noMatches")}</p>
          ) : (
            grouped.map((group) => (
              <section key={group.slug} className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                  {group.name}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">({group.items.length})</span>
                </h2>
                <div className="divide-y rounded-md border border-border bg-background/80">
                  {group.items.map((s) => (
                    <div
                      key={`${group.slug}-${s.id}`}
                      className="flex flex-col sm:flex-row sm:items-start gap-3 p-4"
                    >
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <PujaTitle name={s.name} className="min-w-0" />
                          <p className="text-sm font-semibold text-primary">{t("web.services.dakshina", { amount: rupees(s.dakshina_paise) })}</p>
                        </div>
                        {s.short_description ? (
                          <p className="text-xs text-muted-foreground line-clamp-2">{s.short_description}</p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={s.applied ? "secondary" : "default"}
                        disabled={s.applied || applyingId === s.id}
                        className={cn(
                          "shrink-0 w-full sm:w-auto min-w-[100px]",
                          s.applied && "bg-muted text-muted-foreground border border-border",
                        )}
                        onClick={() => void applyForService(s.id)}
                      >
                        {s.applied ? t("web.services.applied") : applyingId === s.id ? t("web.services.applying") : t("web.services.apply")}
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <PujariOnboardingWalkthrough
          page="services"
          saving={!!applyingId}
          fieldErrors={walkthroughErrors}
          onFieldErrors={setWalkthroughErrors}
          beforeContinue={persistServiceSelection}
        />
      </div>
    </PujariPortal>
  );
}
