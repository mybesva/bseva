import { sevaTypeLabel, translatedTokenLabel } from "@bseva/config";
import { useState } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, apiBase, getToken, rupees } from "@/lib/api";
import { formatDisplayDateTime } from "@/lib/formatDate";
import { useI18n } from "@/i18n/I18nProvider";
import { Calendar, ExternalLink, FileImage, Package } from "lucide-react";
import { toast } from "sonner";
import type { SevaRegistration } from "@bseva/types";
import { PujaTitle } from "@/components/PujaTitle";

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

export default function SevaRegistrationCard({ reg }: { reg: SevaRegistration }) {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const title = reg.event_title || reg.service_name || "";
  const isOnline =
    reg.participation_mode === "online" || String(reg.event_participation_mode || "").includes("online");

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

  /** Proof files are private: fetch with the customer's session, then show the file in a new tab. */
  async function openProof(reg: SevaRegistration) {
    const tab = window.open("", "_blank"); // open synchronously so popup blockers allow it
    try {
      const headers = new Headers();
      const token = getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(`${apiBase()}/api/v1/customer/seva/registrations/${reg.id}/proof`, { headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail || t("seva.proofUnavailable"));
      }
      const url = URL.createObjectURL(await res.blob());
      if (tab) tab.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      tab?.close();
      toast.error(e?.message || t("seva.proofUnavailable"));
    }
  }

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-lg">
            <PujaTitle name={title} />
          </h3>
          {reg.registration_number ? (
            <p className="text-xs text-muted-foreground">#{reg.registration_number}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{sevaTypeLabel(reg.service_type)}</Badge>
        <Badge variant="secondary">
          {reg.status
            ? translatedTokenLabel(t(`status.${reg.status}`), `status.${reg.status}`, reg.status)
            : t("seva.upcoming")}
        </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Calendar size="0.875rem" />
          {formatDisplayDateTime(reg.event_start_at)}
        </span>
        {reg.temple_name ? <span>{reg.temple_name}</span> : null}
        {reg.package_name ? (
          <span className="flex items-center gap-1.5">
            <Package size="0.875rem" />
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
            <FileImage size="0.875rem" />
            {t("seva.proof")}
          </Button>
        ) : null}
        {reg.prasad_tracking ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground self-center">
            <ExternalLink size="0.75rem" />
            {reg.prasad_courier}: {reg.prasad_tracking}
          </span>
        ) : null}
      </div>
    </div>
  );
}
