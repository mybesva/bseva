import { useEffect, useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, rupees } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

type AstrologyService = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  standard_price_paise?: number;
  duration_minutes?: number;
  muhurta_consultation_enabled?: boolean;
};

export default function AstrologyPage() {
  const { t } = useI18n();
  const [services, setServices] = useState<AstrologyService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AstrologyService[]>("/astrology/services")
      .then(setServices)
      .catch((e) => toast.error(e.message || "Could not load astrology services"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <section className="bg-sidebar text-sidebar-foreground py-12">
        <div className="container">
          <h1 className="text-h1">{t("nav.astrology")}</h1>
          <p className="text-sidebar-foreground/80 mt-2 max-w-2xl">
            Jyotisha guidance from verified pujaris — horoscope readings, muhurta selection and remedial pujas.
          </p>
        </div>
      </section>

      <div className="container py-12">
        {loading && <Skeleton className="h-40 w-full" />}
        {!loading && services.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="text-muted-foreground">
                Astrology services are being added. Please check back soon.
              </p>
              <Link href="/services">
                <Button variant="outline">{t("nav.services")}</Button>
              </Link>
            </CardContent>
          </Card>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s) => (
            <Card key={s.id} className="hover:shadow-md transition-shadow border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-sidebar flex items-center gap-2">
                  <Sparkles className="text-primary" size={18} />
                  {s.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-3">{s.description}</p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-sidebar">
                    From {rupees(s.standard_price_paise || 0)}
                  </span>
                  {s.duration_minutes ? (
                    <Badge variant="outline">{s.duration_minutes} min</Badge>
                  ) : null}
                  {s.muhurta_consultation_enabled && <Badge variant="secondary">Muhurta</Badge>}
                </div>
                <Link href={`/book/${s.slug}`}>
                  <Button className="w-full bg-primary hover:bg-primary/90 font-bold">
                    {t("nav.bookPuja")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
