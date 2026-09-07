import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import Layout from "@/components/Layout";
import BookingWizard from "@/components/BookingWizard";
import { Button } from "@/components/ui/button";
import { api, rupees } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function Book() {
  const params = useParams();
  const pujaSlug = params.slug as string;
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { config: publicConfig } = usePublicConfig();
  const [pujaType, setPujaType] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [muhurtaRequested, setMuhurtaRequested] = useState(false);
  const [requestingMuhurta, setRequestingMuhurta] = useState(false);

  async function requestMuhurta() {
    if (!pujaType) return;
    setRequestingMuhurta(true);
    try {
      const out = await api<{ fee_paise: number; payment_status: string }>("/muhurta-consultations", {
        method: "POST",
        body: JSON.stringify({ service_id: pujaType.id }),
      });
      setMuhurtaRequested(true);
      toast.success(
        out.payment_status === "paid"
          ? `Muhurta consultation booked. ${rupees(out.fee_paise)} debited — keep this as your payment record. Book marriage services with us later for a discount.`
          : "Muhurta consultation booked. A pujari will share guidance shortly. Book marriage services with us later for a discount."
      );
    } catch (e: any) {
      toast.error(e.message || "Could not request a consultation");
    } finally {
      setRequestingMuhurta(false);
    }
  }

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
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#F7931E]" />
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
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Service Not Found</h1>
            <p className="text-gray-600">The requested puja service could not be found.</p>
            <Button onClick={() => setLocation("/services")}>Browse services</Button>
          </div>
        </div>
      </Layout>
    );
  }

  const muhurtaFee = Number(
    pujaType.muhurta_fee_paise ?? publicConfig?.muhurta_consultation_fee_paise ?? 0
  );
  const showMuhurta =
    user?.role === "customer" && (pujaType.muhurta_consultation_enabled || pujaType.requires_muhurta);

  return (
    <Layout>
      <section className="bg-sidebar text-sidebar-foreground py-10">
        <div className="container">
          <h1 className="font-heading text-3xl font-bold">{pujaType.name}</h1>
          <p className="text-sidebar-foreground/80 mt-1">
            {publicConfig?.virtual_puja_enabled
              ? "Book Standard or Premium · In-person or Virtual"
              : "Book Standard or Premium · In-person"}
          </p>
        </div>
      </section>
      <div className="container pb-12">
        {showMuhurta && (
          <div className="mt-6 rounded-lg border border-primary/30 bg-orange-50/60 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <Sparkles className="text-primary mt-0.5 shrink-0" size={20} />
                <div className="min-w-0">
                  <p className="font-heading font-semibold text-sidebar">
                    {pujaType.requires_muhurta
                      ? "This puja needs an auspicious time (muhurta)"
                      : "Not sure about the right muhurta?"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {muhurtaRequested
                      ? "Your muhurta request is booked. A pujari will share recommended dates and times, then you can complete this booking."
                      : muhurtaFee > 0
                        ? `Request muhurta guidance from a pujari for ${rupees(muhurtaFee)} (debited from your wallet). You get a payment record for this consultation. You can still pick a date below.`
                        : "Request muhurta guidance from a pujari before you pick a date. You can still continue booking below."}
                  </p>
                </div>
              </div>
              {!muhurtaRequested && (
                <Button
                  variant="secondary"
                  disabled={requestingMuhurta}
                  onClick={() => void requestMuhurta()}
                >
                  {requestingMuhurta ? "Requesting…" : "Request muhurta consultation"}
                </Button>
              )}
            </div>

            <div className="rounded-md border border-primary/20 bg-white/80 px-3 py-2.5 text-sm space-y-1">
              <p className="font-medium text-sidebar">B-Seva benefit</p>
              <p className="text-muted-foreground">
                If you set your muhurtham through B-Seva, you get a discount when you book marriage /
                wedding services with us (for example Vivaha / marriage puja). The consultation fee stays
                on your account as a paid record, same as a booking receipt.
              </p>
            </div>

            {muhurtaRequested && (
              <div className="rounded-md border bg-white px-3 py-2.5 text-sm space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-green-700">Requested · awaiting pujari guidance</span>
                </div>
                {muhurtaFee > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Consultation fee</span>
                    <span className="font-medium">{rupees(muhurtaFee)}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  Keep this confirmation — it counts toward your marriage-service discount when you book
                  with B-Seva.
                </p>
              </div>
            )}
          </div>
        )}
        <BookingWizard
          serviceId={pujaType.id}
          pujaName={pujaType.name}
          basePrices={{
            standard: pujaType.standard_price_paise,
            premium: pujaType.premium_price_paise,
          }}
          addonPrices={{
            samagri: pujaType.samagri_price_paise,
            alankaram: pujaType.alankaram_price_paise,
            food: pujaType.food_price_paise,
            // Always show optional Samagri + Alankaram on customer booking.
            samagriAvailable: true,
            alankaramAvailable: true,
            foodAvailable: Boolean(pujaType.food_available),
          }}
        />
      </div>
    </Layout>
  );
}
