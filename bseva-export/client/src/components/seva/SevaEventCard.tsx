import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDisplayDateTime } from "@/lib/formatDate";
import { rupees } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { Calendar, MapPin, Users, Video } from "lucide-react";
import type { ParticipationMode, PujaEventKind, SevaEvent } from "@bseva/types";
import { PujaTitle } from "@/components/PujaTitle";

function participationLabel(t: (key: string) => string, mode?: ParticipationMode) {
  if (mode === "online") return t("seva.online");
  if (mode === "hybrid") return t("seva.hybrid");
  return t("seva.offline");
}

function statusLabel(t: (key: string) => string, status?: string) {
  switch (status) {
    case "live":
      return t("seva.live");
    case "completed":
      return t("seva.completed");
    case "cancelled":
      return t("seva.cancelled");
    default:
      return t("seva.upcoming");
  }
}

function pujaKindLabel(t: (key: string) => string, kind?: PujaEventKind | null) {
  if (kind === "group_live") return t("seva.groupLivePuja");
  if (kind === "proxy") return t("seva.proxyPuja");
  return null;
}

type SevaEventCardProps = {
  event: SevaEvent;
  onOpen?: () => void;
  actionLabel?: string;
};

export default function SevaEventCard({ event, onOpen, actionLabel }: SevaEventCardProps) {
  const { t } = useI18n();
  const title = event.title || event.service_name || "";
  const templeLine = [event.temple_name, event.temple_city].filter(Boolean).join(", ");
  const kindLabel = pujaKindLabel(t, event.puja_event_kind);
  const soldOut = Boolean(event.sold_out);
  const closed = event.registration_open === false;
  const seats =
    event.seats_remaining != null
      ? t("seva.seatsRemaining", { count: event.seats_remaining })
      : null;

  return (
    <Card className="h-full flex flex-col border-border/80 hover:border-primary/30 transition-colors">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-lg leading-snug min-w-0">
            <PujaTitle name={title} />
          </CardTitle>
          <div className="flex flex-wrap gap-1.5 shrink-0">
            <Badge variant="secondary">{statusLabel(t, event.display_status || event.status)}</Badge>
            <Badge variant="outline">{participationLabel(t, event.participation_mode)}</Badge>
          </div>
        </div>
        {kindLabel ? <p className="text-sm text-muted-foreground">{kindLabel}</p> : null}
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground flex-1">
        <p className="flex items-center gap-2">
          <Calendar size={15} className="shrink-0 text-primary" />
          {formatDisplayDateTime(event.start_at)}
        </p>
        {templeLine ? (
          <p className="flex items-start gap-2">
            <MapPin size={15} className="shrink-0 text-primary mt-0.5" />
            <span>{templeLine}</span>
          </p>
        ) : null}
        {event.online_enabled ? (
          <p className="flex items-center gap-2">
            <Video size={15} className="shrink-0 text-primary" />
            {t("seva.online")}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge className={event.is_free ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}>
            {event.is_free ? t("seva.free") : t("seva.paid")}
          </Badge>
          {!event.is_free && event.price_paise != null ? (
            <span className="font-semibold text-foreground">{rupees(event.price_paise)}</span>
          ) : null}
        </div>
        {soldOut ? (
          <p className="text-destructive font-medium">{t("seva.soldOut")}</p>
        ) : closed ? (
          <p className="font-medium">{t("seva.registrationClosed")}</p>
        ) : seats ? (
          <p className="flex items-center gap-2">
            <Users size={15} className="shrink-0" />
            {seats}
          </p>
        ) : null}
      </CardContent>
      {onOpen ? (
        <CardFooter className="pt-0">
          <Button type="button" className="w-full" onClick={onOpen} disabled={soldOut || closed}>
            {actionLabel || t("common.viewDetails")}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
