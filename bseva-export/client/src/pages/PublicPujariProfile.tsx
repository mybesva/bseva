import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

function parseList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const j = JSON.parse(v);
      return Array.isArray(j) ? j.map(String) : [];
    } catch {
      return v ? [v] : [];
    }
  }
  return [];
}

export default function PublicPujariProfile() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [p, setP] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    api<any>(`/pujaris/${id}/public`)
      .then(setP)
      .catch((e) => toast.error(e.message));
  }, [id]);

  return (
    <Layout>
      <div className="container py-10 max-w-2xl">
        {!p ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-2xl flex flex-wrap items-center gap-2">
                {p.name}
                <Badge variant="secondary">L{p.approved_level}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t("pujari.public.location")}</p>
                <p className="font-medium">
                  {[p.city, p.district, p.state].filter(Boolean).join(", ") || "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("pujari.public.experience")}</p>
                <p className="font-medium">{p.experience_years ?? 0} {t("pujari.public.years")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("pujari.public.ratings")}</p>
                <p className="font-medium">
                  ★ {Number(p.avg_stars || 0).toFixed(1)} ({p.rating_count || 0})
                </p>
              </div>
              {p.sampradaya && (
                <div>
                  <p className="text-muted-foreground">{t("pujari.public.sampradaya")}</p>
                  <p className="font-medium">{p.sampradaya}</p>
                </div>
              )}
              {p.gotra && (
                <div>
                  <p className="text-muted-foreground">{t("pujari.public.gotra")}</p>
                  <p className="font-medium">{p.gotra}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">{t("pujari.public.languages")}</p>
                <p className="font-medium">{parseList(p.languages).join(", ") || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("pujari.public.specializations")}</p>
                <p className="font-medium">{parseList(p.specializations).join(", ") || "—"}</p>
              </div>
              <p className="text-xs text-muted-foreground">{t("pujari.public.privacy")}</p>
              <Link href="/services">
                <Button>{t("nav.bookPuja")}</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
