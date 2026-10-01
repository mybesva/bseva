import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import PujaDiscovery from "@/components/seva/PujaDiscovery";
import SevaTypePane from "@/components/seva/SevaTypePane";
import SevaTypeTabs from "@/components/seva/SevaTypeTabs";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useLocation, useSearch } from "wouter";
import { api } from "@/lib/api";
import {
  enabledSevaServiceTypes,
  resolveSevaServiceType,
  servicesPathForType,
  type SevaConfigFlags,
  type SevaServiceType,
} from "@bseva/config";

/**
 * Explore Services: one customer discovery page with three Seva lines.
 *
 *   /services                → Puja Seva (default; original Explore catalogue)
 *   /services?type=chadhava  → Chadhava Seva
 *   /services?type=pravachan → Pravachan Seva
 *
 * Puja keeps `?q=&category=`. Legacy `/seva*` URLs redirect here (see SevaHub).
 */
export default function Services() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const [config, setConfig] = useState<SevaConfigFlags | null>(null);
  const [configReady, setConfigReady] = useState(false);

  useEffect(() => {
    api<SevaConfigFlags>("/seva/config")
      .then(setConfig)
      .catch(() => setConfig(null))
      .finally(() => setConfigReady(true));
  }, []);

  const enabledTypes = useMemo(() => enabledSevaServiceTypes(config), [config]);
  const requestedType = useMemo(() => new URLSearchParams(searchStr).get("type"), [searchStr]);
  const activeType = resolveSevaServiceType(requestedType, enabledTypes);

  function selectType(type: SevaServiceType) {
    setLocation(servicesPathForType(type));
  }

  return (
    <Layout>
      <section className="relative pt-10 md:pt-12 pb-0 lg:py-12 bg-sidebar text-white overflow-hidden lg:min-h-[19rem] lg:flex lg:items-center">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="container relative z-10 text-center lg:text-left">
          <div className="mx-auto lg:mx-0 max-w-2xl lg:max-w-[54%]">
            <span className="inline-block py-1 px-3 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/60 text-primary text-xs font-bold tracking-[0.2em] uppercase mb-3">
              {t("services.badge")}
            </span>
            <h1 className="text-h1 md:text-display text-primary mb-3">{t("services.title")}</h1>
            <p className="text-base text-on-dark">{t("services.subtitle")}</p>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none relative z-0 mt-6 h-44 sm:h-56 md:h-64 lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:h-auto lg:w-[46%] lg:max-w-[760px] isolate bg-sidebar [mask-image:linear-gradient(to_bottom,transparent_0%,black_60%)] lg:[mask-image:linear-gradient(to_right,transparent_0%,black_55%)]"
        >
          <img
            src="/images/services-hero-puja.webp"
            alt=""
            loading="eager"
            className="h-full w-full object-cover object-[50%_55%] mix-blend-lighten lg:object-[right_55%]"
          />
        </div>
      </section>

      <section className="py-10 md:py-14">
        <div className="container">
          <SevaTypeTabs value={activeType} types={enabledTypes} onChange={selectType}>
            {activeType === "puja" ? (
              <PujaDiscovery />
            ) : configReady ? (
              <SevaTypePane key={activeType} type={activeType} />
            ) : (
              <div className="flex justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            )}
          </SevaTypeTabs>
        </div>
      </section>

      {activeType === "puja" ? (
        <>
          <section className="py-16 bg-secondary/15">
            <div className="container max-w-3xl text-center md:text-left">
              <SectionHeader title={t("services.discoveryTitle")} className="mb-6" />
              <p className="text-muted-foreground leading-relaxed mb-4">{t("services.discoveryP1")}</p>
              <p className="text-muted-foreground leading-relaxed">{t("services.discoveryP2")}</p>
            </div>
          </section>

          <section className="py-16 bg-secondary/20">
            <div className="container text-center">
              <SectionHeader title={t("services.customTitle")} description={t("services.customDesc")} />
              <Button
                size="lg"
                className="bg-primary text-white hover:bg-primary/90 px-8 h-12 text-lg font-bold shadow-lg"
                onClick={() => {
                  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
                  setLocation("/contact");
                }}
              >
                {t("services.requestCustom")}
              </Button>
            </div>
          </section>
        </>
      ) : null}
    </Layout>
  );
}
