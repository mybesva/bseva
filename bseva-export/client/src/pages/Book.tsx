import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import Layout from "@/components/Layout";
import BookingWizard from "@/components/BookingWizard";
import MuhurtaConsultationBook from "@/components/MuhurtaConsultationBook";
import ServiceAvailabilityBanner from "@/components/ServiceAvailabilityBanner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useServiceAvailability } from "@/lib/ServiceAvailabilityContext";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

export default function Book() {
  const { t } = useI18n();
  const params = useParams();
  const pujaSlug = params.slug as string;
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { config: publicConfig } = usePublicConfig();
  const { canBook, checking, status } = useServiceAvailability();
  const [pujaType, setPujaType] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inCustomerPortal = user?.role === "customer";

  useEffect(() => {
    if (authLoading) return;
    const returnPath = `/book/${pujaSlug}`;
    if (!isAuthenticated || (user && user.role !== "customer" && user.role !== "admin" && user.role !== "super_admin")) {
      setLocation(getLoginUrl({ role: "customer", returnPath }));
      return;
    }
    setIsLoading(true);
    api(`/services/${pujaSlug}`)
      .then(setPujaType)
      .catch(() => setPujaType(null))
      .finally(() => setIsLoading(false));
  }, [pujaSlug, authLoading, isAuthenticated, user, setLocation]);

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!pujaType) {
    return (
      <Layout>
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-h1 text-foreground mb-2">{t("common.notFound")}</h1>
            <p className="text-muted-foreground">{t("web.book.serviceNotFound")}</p>
            <Button onClick={() => setLocation(inCustomerPortal ? "/customer" : "/services")}>
              {inCustomerPortal ? t("home.goDashboard") : t("web.book.browseServices")}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const muhurtaFee = Number(pujaType.muhurta_fee_paise || 0);
  const showMuhurta =
    user?.role === "customer" && (pujaType.muhurta_consultation_enabled || pujaType.requires_muhurta);

  const virtualOn =
    Boolean(publicConfig?.virtual_puja_enabled) && pujaType.virtual_available !== false;
  const inPersonBlocked = user?.role === "customer" && (!canBook || checking);
  const blockBooking = inPersonBlocked && !virtualOn;
  const forceVirtualOnly =
    user?.role === "customer" && virtualOn && !checking && status === "unavailable";
  const serviceNotBookable = pujaType.bookable === false;

  return (
    <Layout>
      {inCustomerPortal ? (
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{pujaType.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {publicConfig?.virtual_puja_enabled
              ? t("web.book.subtitleVirtual")
              : t("web.book.subtitleInPerson")}
          </p>
        </div>
      ) : (
        <section className="bg-sidebar text-sidebar-foreground py-10 -mx-4 lg:-mx-8 mb-6 px-4 lg:px-8">
          <div className="container px-0">
            <h1 className="text-h1 text-primary">{pujaType.name}</h1>
            <p className="text-sidebar-foreground/80 mt-1">
              {publicConfig?.virtual_puja_enabled
                ? t("web.book.subtitleVirtual")
                : t("web.book.subtitleInPerson")}
            </p>
          </div>
        </section>
      )}

      {user?.role === "customer" ? (
        <ServiceAvailabilityBanner
          virtualHref={virtualOn ? `/book/${pujaType.canonical_slug || pujaType.slug || pujaSlug}` : undefined}
        />
      ) : null}

      {serviceNotBookable ? (
        <div className="pb-8 max-w-2xl space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 px-5 py-5">
            <h2 className="text-lg font-semibold text-foreground mb-2">{t("web.book.notOpen")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("web.book.notOpenBody")}
            </p>
          </div>
          <Button variant="outline" onClick={() => setLocation(inCustomerPortal ? "/customer" : "/services")}>
            {inCustomerPortal ? t("home.goDashboard") : t("web.book.browseServices")}
          </Button>
        </div>
      ) : blockBooking ? (
        <div className="pb-8 max-w-2xl space-y-4">
          {status === "unavailable" ? (
            <div className="rounded-xl border border-primary/25 bg-orange-50/80 dark:bg-orange-950/30 px-5 py-5">
              <h2 className="text-lg font-bold text-[#1A2B4A] dark:text-primary mb-2">
                {publicConfig.service_area_unavailable_heading?.trim() || t("web.availability.comingSoonTitle")}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {publicConfig.service_area_unavailable_description?.trim() || t("web.availability.comingSoonBody")}
              </p>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {t("web.book.areaUnavailableBody")}
          </p>
          <Button variant="outline" onClick={() => setLocation(inCustomerPortal ? "/customer" : "/services")}>
            {inCustomerPortal ? t("home.goDashboard") : t("web.book.browseServices")}
          </Button>
        </div>
      ) : (
        <div className={inCustomerPortal ? "pb-8" : "container pb-12 px-0"}>
          {showMuhurta && (
            <MuhurtaConsultationBook
              serviceId={pujaType.id}
              serviceName={pujaType.name}
              requiresMuhurtham={Boolean(pujaType.requires_muhurta)}
              feePaise={muhurtaFee}
            />
          )}
          <BookingWizard
            serviceId={pujaType.id}
            pujaName={pujaType.name}
            serviceCategories={pujaType.categories}
            forceVirtualOnly={forceVirtualOnly}
            serviceVirtualAvailable={pujaType.virtual_available !== false}
            durationMinutes={pujaType.duration_minutes}
            bookingLeadHours={
              pujaType.booking_lead_hours != null ? Number(pujaType.booking_lead_hours) : 48
            }
            basePrices={{
              basic: pujaType.basic_price_paise || undefined,
              standard: pujaType.standard_price_paise,
              premium: pujaType.premium_price_paise,
            }}
            addonPrices={{
              samagri:
                pujaType.customer_samagri_price_paise ?? pujaType.samagri_price_paise,
              alankaram: pujaType.alankaram_price_paise,
              food: pujaType.food_price_paise,
              samagriAvailable: pujaType.samagri_available !== false,
              alankaramAvailable: Boolean(pujaType.alankaram_available),
              foodAvailable: Boolean(pujaType.food_available),
            }}
            pujariTeam={{
              pujaris_required: pujaType.pujaris_required,
              priests_min: pujaType.priests_min,
              basic_pujaris_required: pujaType.basic_pujaris_required,
              standard_pujaris_required: pujaType.standard_pujaris_required,
              premium_pujaris_required: pujaType.premium_pujaris_required,
              package_pujaris: pujaType.package_pujaris,
            }}
          />
        </div>
      )}
    </Layout>
  );
}
