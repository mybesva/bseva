import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import PujaDiscovery from "@/components/seva/PujaDiscovery";
import SevaTypePane from "@/components/seva/SevaTypePane";
import SevaTypeTabs from "@/components/seva/SevaTypeTabs";
import ServicesHero from "@/components/services/ServicesHero";
import ServicesWhyChoose from "@/components/services/ServicesWhyChoose";
import ServicesCustomCta from "@/components/services/ServicesCustomCta";
import { Loader2 } from "lucide-react";
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
      <ServicesHero />

      <section className="relative bg-[#FFF8EE] pb-2 pt-6 dark:bg-background md:pt-8">
        <div className="container relative z-10">
          <SevaTypeTabs value={activeType} types={enabledTypes} onChange={selectType}>
            {activeType === "puja" ? (
              <PujaDiscovery />
            ) : configReady ? (
              <SevaTypePane key={activeType} type={activeType} />
            ) : (
              <div className="flex justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            )}
          </SevaTypeTabs>
        </div>
      </section>

      {activeType === "puja" ? (
        <>
          <ServicesWhyChoose />
          <ServicesCustomCta />
        </>
      ) : null}
    </Layout>
  );
}
