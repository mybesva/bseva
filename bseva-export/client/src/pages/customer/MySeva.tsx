import { translatedTokenLabel } from "@bseva/config";
import { useEffect, useMemo, useState } from "react";
import { CustomerPortal } from "@/components/RolePortals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, mediaSrc, rupees } from "@/lib/api";
import { formatDisplayDateTime } from "@/lib/formatDate";
import { useI18n } from "@/i18n/I18nProvider";
import { Link, useLocation } from "wouter";
import { Calendar, ExternalLink, FileImage, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import type { SevaRegistration, ServiceType } from "@bseva/types";
import { PujaTitle } from "@/components/PujaTitle";

type FilterKey = "all" | ServiceType | "upcoming" | "completed";

function filterLabel(t: (key: string) => string, key: FilterKey) {
  switch (key) {
    case "puja":
      return t("seva.filter.puja");
    case "chadhava":
      return t("seva.filter.chadhava");
    case "pravachan":
      return t("seva.filter.pravachan");
    case "upcoming":
      return t("seva.upcoming");
    case "completed":
      return t("seva.completed");
    default:
      return t("seva.filter.all");
  }
}

function prasadLabel(t: (key: string) => string, status?: string) {
  switch (status) {
    case "preparing":
      return t("seva.prasad.preparing");
    case "ready":
      return t("seva.prasad.ready");
    case "shipped":
      return t("seva.prasad.shipped");
    case "delivered":
      return t("seva.prasad.delivered");
    default:
      return t("seva.prasad.notApplicable");
  }
}

const FILTERS: FilterKey[] = ["all", "puja", "chadhava", "pravachan", "upcoming", "completed"];

export default function MySevaPage() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [rows, setRows] = useState<SevaRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filter === "puja" || filter === "chadhava" || filter === "pravachan") {
      params.set("service_type", filter);
    } else if (filter === "upcoming" || filter === "completed") {
      params.set("status_filter", filter);
    }
    const s = params.toString();
    return s ? `?${s}` : "";
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    api<SevaRegistration[]>(`/seva/my-registrations${query}`)
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e: Error) => {
        toast.error(e.message || t("errors.generic"));
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [query, t]);

  async function handleJoinLive(reg: SevaRegistration) {
    setJoiningId(reg.id);
    try {
      const detail = await api<SevaRegistration>(
        `/seva/my-registrations/${encodeURIComponent(reg.id)}`
      );
      if (detail.can_join_live && detail.join_token) {
        setLocation(`/join/${detail.join_token}`);
        return;
      }
      toast.error(detail.join_message || t("errors.generic"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("errors.generic"));
    } finally {
      setJoiningId(null);
    }
  }

  function openProof(reg: SevaRegistration) {
    const src = mediaSrc(reg.proof_image_path);
    if (src) window.open(src, "_blank", "noopener,noreferrer");
  }

  return (
    <CustomerPortal>
      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>{t("seva.mySeva")}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{t("seva.events")}</p>
            </div>
            <Button type="button" variant="outline" asChild>
              <Link href="/services">{t("seva.explore")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {FILTERS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                    filter === key
                      ? "bg-primary text-white border-primary"
                      : "bg-card text-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {filterLabel(t, key)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">{t("seva.noRegistrations")}</p>
            ) : (
              <div className="space-y-4">
                {rows.map((reg) => {
                  const title = reg.event_title || reg.service_name || "";
                  const isOnline =
                    reg.participation_mode === "online" ||
                    String(reg.event_participation_mode || "").includes("online");
                  return (
                    <div key={reg.id} className="rounded-lg border border-border p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <h3 className="font-semibold text-lg">
                            <PujaTitle name={title} />
                          </h3>
                          {reg.registration_number ? (
                            <p className="text-xs text-muted-foreground">#{reg.registration_number}</p>
                          ) : null}
                        </div>
                        <Badge variant="secondary">
                          {reg.status
                            ? translatedTokenLabel(t(`status.${reg.status}`), `status.${reg.status}`, reg.status)
                            : t("seva.upcoming")}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} />
                          {formatDisplayDateTime(reg.event_start_at)}
                        </span>
                        {reg.temple_name ? <span>{reg.temple_name}</span> : null}
                        {reg.package_name ? (
                          <span className="flex items-center gap-1.5">
                            <Package size={14} />
                            {reg.package_name}
                          </span>
                        ) : null}
                        {(reg.total_amount_paise || 0) > 0 ? (
                          <span>{rupees(reg.total_amount_paise || 0)}</span>
                        ) : (
                          <span>{t("seva.free")}</span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 text-sm">
                        <Badge variant="outline">{prasadLabel(t, reg.prasad_status)}</Badge>
                        {reg.proof_released ? (
                          <Badge className="bg-green-100 text-green-800">{t("seva.proofAvailable")}</Badge>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setLocation(`/seva/events/${reg.event_id}`)}
                        >
                          {t("common.view")}
                        </Button>
                        {isOnline ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={joiningId === reg.id}
                            onClick={() => void handleJoinLive(reg)}
                          >
                            {joiningId === reg.id ? t("common.loading") : t("seva.joinLive")}
                          </Button>
                        ) : null}
                        {reg.proof_released && reg.proof_image_path ? (
                          <Button type="button" size="sm" variant="secondary" onClick={() => openProof(reg)}>
                            <FileImage size={14} />
                            {t("seva.proof")}
                          </Button>
                        ) : null}
                        {reg.prasad_tracking ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground self-center">
                            <ExternalLink size={12} />
                            {reg.prasad_courier}: {reg.prasad_tracking}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CustomerPortal>
  );
}
