import { useEffect, useState } from "react";
import { Flame, Loader2, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import ServiceCard from "@/components/ServiceCard";
import SevaEventCard from "@/components/seva/SevaEventCard";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import { formatStartingFrom } from "@/lib/servicePricing";
import { serviceImageUrl } from "@/lib/serviceImage";
import { servicesOfType } from "@bseva/config";
import type { CatalogService, SevaEvent, ServiceType } from "@bseva/types";

const ICONS = { chadhava: Flame, pravachan: Sparkles } as const;
const LABEL_KEYS = { chadhava: "seva.chadhava", pravachan: "seva.pravachan" } as const;

type SevaTypePaneProps = { type: Exclude<ServiceType, "puja"> };

/**
 * Chadhava Seva / Pravachan Seva pane. Uses the existing Seva service and event APIs.
 * Service cards open the service detail page; event cards open `/seva/events/:id`, which keeps
 * the wallet-based Seva registration flow (never the Puja booking wizard).
 */
export default function SevaTypePane({ type }: SevaTypePaneProps) {
  const { t, lang } = useI18n();
  const [, setLocation] = useLocation();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [events, setEvents] = useState<SevaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const Icon = ICONS[type];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api<CatalogService[]>(`/seva/services?service_type=${encodeURIComponent(type)}`),
      api<SevaEvent[]>(`/seva/events?service_type=${encodeURIComponent(type)}`),
    ])
      .then(([svc, ev]) => {
        if (cancelled) return;
        setServices(servicesOfType(Array.isArray(svc) ? svc : [], type));
        setEvents((Array.isArray(ev) ? ev : []).filter((e) => !e.service_type || e.service_type === type));
      })
      .catch((e: Error) => {
        if (cancelled) return;
        toast.error(e.message || t("errors.generic"));
        setServices([]);
        setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type, t]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-10" data-testid={`seva-pane-${type}`}>
      {services.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-h3 text-foreground">{t(LABEL_KEYS[type])}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {services.map((svc) => {
              const starting = formatStartingFrom(svc, lang);
              const desc = svc.short_description || svc.description || (starting ? "" : t("services.pricingSoon"));
              const open = () => setLocation(`/services/${svc.slug}`);
              return (
                <div
                  key={svc.id}
                  className="cursor-pointer min-w-0 h-full flex"
                  onClick={open}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      open();
                    }
                  }}
                  role="link"
                  tabIndex={0}
                >
                  <ServiceCard
                    title={svc.name}
                    description={desc}
                    image={serviceImageUrl(svc)}
                    icon={<Icon size={20} />}
                    startingFrom={starting}
                    onReadMore={open}
                    onBookNow={open}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        <h2 className="text-h3 text-foreground">{t("seva.events")}</h2>
        {events.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">{t("seva.noEvents")}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {events.map((ev) => (
              <SevaEventCard
                key={ev.id}
                event={ev}
                actionLabel={t("seva.register")}
                onOpen={() => setLocation(`/seva/events/${ev.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
