import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import ServiceCard from "@/components/ServiceCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flame, Flower, Home, Sparkles, Heart, Star, Sun, Moon, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

const ICONS = [Flower, Home, Flame, Heart, Sun, Star, Moon, Sparkles];

export default function Services() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<any[]>("/services")
      .then(setServices)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  function openService(slug: string) {
    const path = `/book/${slug}`;
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== "customer") {
      setLocation(getLoginUrl({ role: "customer", returnPath: path }));
      return;
    }
    setLocation(path);
  }

  const cards = useMemo(
    () =>
      (services || []).map((s, i) => {
        const Icon = ICONS[i % ICONS.length];
        return (
          <div key={s.id} onClick={() => openService(s.slug)} className="cursor-pointer">
            <ServiceCard
              title={s.name}
              description={s.description || `From ₹${((s.standard_price_paise || 0) / 100).toLocaleString("en-IN")}`}
              image={i % 2 === 0 ? "/images/puja-thali.png" : "/images/temple-ritual.png"}
              icon={<Icon size={24} />}
            />
          </div>
        );
      }),
    [services, isAuthenticated, user, authLoading]
  );

  return (
    <Layout>
      <section className="relative py-20 bg-sidebar text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="Pattern" className="w-full h-full object-cover" />
        </div>
        <div className="container relative z-10 text-center">
          <h1 className="font-heading font-bold text-4xl md:text-6xl mb-6">{t("services.title")}</h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">{t("services.subtitle")}</p>
        </div>
      </section>

      <section className="py-16">
        <div className="container">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="all" className="w-full">
              <div className="flex justify-center mb-12">
                <TabsList className="bg-secondary/30 p-1 h-auto flex-wrap justify-center gap-2">
                  <TabsTrigger value="all" className="px-6 py-3 text-base data-[state=active]:bg-primary data-[state=active]:text-white">
                    {t("services.all")}
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="all" className="mt-0">
                {cards.length === 0 ? (
                  <p className="text-center text-muted-foreground">No active services yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{cards}</div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </section>

      <section className="py-20 bg-secondary/20">
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
