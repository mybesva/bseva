import { useEffect, useState, type ReactNode } from "react";
import { useParams, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { CustomerPortal } from "@/components/RolePortals";
import BookingWizard from "@/components/BookingWizard";
import MuhurtaConsultationBook from "@/components/MuhurtaConsultationBook";
import ServiceAvailabilityBanner from "@/components/ServiceAvailabilityBanner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useServiceAvailability } from "@/lib/ServiceAvailabilityContext";
import {
  COMING_SOON_BODY,
  COMING_SOON_TITLE,
} from "@/lib/serviceAvailabilityMessages";
import { Loader2 } from "lucide-react";

function BookShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Logged-in customers book inside the Customer portal (no public site headers).
  if (user?.role === "customer") {
    return <CustomerPortal>{children}</CustomerPortal>;
  }
  return <Layout>{children}</Layout>;
}

export default function Book() {
  const params = useParams();
  const pujaSlug = params.slug as string;
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { config: publicConfig } = usePublicConfig();
  const { canBook, checking, status, refresh } = useServiceAvailability();
  const [pujaType, setPujaType] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inCustomerPortal = user?.role === "customer";

  useEffect(() => {
    // Soft: skip if provider already resolved after login.
    void refresh();
  }, [refresh]);

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
      <BookShell>
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </BookShell>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!pujaType) {
    return (
      <BookShell>
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-h1 text-foreground mb-2">Service Not Found</h1>
            <p className="text-muted-foreground">The requested puja service could not be found.</p>
            <Button onClick={() => setLocation(inCustomerPortal ? "/customer" : "/services")}>
              {inCustomerPortal ? "Back to dashboard" : "Browse services"}
            </Button>
          </div>
        </div>
      </BookShell>
    );
  }

  const muhurtaFee = Number(
    pujaType.muhurta_fee_paise ?? publicConfig?.muhurta_consultation_fee_paise ?? 0
  );
  const showMuhurta =
    user?.role === "customer" && (pujaType.muhurta_consultation_enabled || pujaType.requires_muhurta);

  const blockBooking = user?.role === "customer" && (!canBook || checking);

  return (
    <BookShell>
      {inCustomerPortal ? (
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{pujaType.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {publicConfig?.virtual_puja_enabled
              ? "Book Standard or Premium · In-person or Virtual"
              : "Book Standard or Premium · In-person"}
          </p>
        </div>
      ) : (
        <section className="bg-sidebar text-sidebar-foreground py-10 -mx-4 lg:-mx-8 mb-6 px-4 lg:px-8">
          <div className="container px-0">
            <h1 className="text-h1 text-primary">{pujaType.name}</h1>
            <p className="text-sidebar-foreground/80 mt-1">
              {publicConfig?.virtual_puja_enabled
                ? "Book Standard or Premium · In-person or Virtual"
                : "Book Standard or Premium · In-person"}
            </p>
          </div>
        </section>
      )}

      {user?.role === "customer" ? <ServiceAvailabilityBanner /> : null}

      {blockBooking ? (
        <div className="pb-8 max-w-2xl space-y-4">
          {status === "unavailable" ? (
            <div className="rounded-xl border border-primary/25 bg-orange-50/80 dark:bg-orange-950/30 px-5 py-5">
              <h2 className="text-lg font-bold text-[#1A2B4A] dark:text-primary mb-2">{COMING_SOON_TITLE}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{COMING_SOON_BODY}</p>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            You can still browse this puja and other services. Booking will unlock when service is available in your area.
          </p>
          <Button variant="outline" onClick={() => setLocation(inCustomerPortal ? "/customer" : "/services")}>
            {inCustomerPortal ? "Back to dashboard" : "Browse services"}
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
            basePrices={{
              basic: pujaType.basic_price_paise || undefined,
              standard: pujaType.standard_price_paise,
              premium: pujaType.premium_price_paise,
            }}
            addonPrices={{
              samagri: pujaType.samagri_price_paise,
              alankaram: pujaType.alankaram_price_paise,
              food: pujaType.food_price_paise,
              samagriAvailable: pujaType.samagri_available !== false,
              alankaramAvailable: Boolean(pujaType.alankaram_available),
              foodAvailable: Boolean(pujaType.food_available),
            }}
          />
        </div>
      )}
    </BookShell>
  );
}
