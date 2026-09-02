import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import Layout from "@/components/Layout";
import BookingWizard from "@/components/BookingWizard";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { Loader2 } from "lucide-react";

export default function Book() {
  const params = useParams();
  const pujaSlug = params.slug as string;
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { config: publicConfig } = usePublicConfig();
  const [pujaType, setPujaType] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        <BookingWizard
          serviceId={pujaType.id}
          pujaName={pujaType.name}
          basePrices={{
            standard: pujaType.standard_price_paise,
            premium: pujaType.premium_price_paise,
          }}
        />
      </div>
    </Layout>
  );
}
