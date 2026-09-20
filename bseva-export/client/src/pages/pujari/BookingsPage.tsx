import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { PujariPortal } from "@/components/RolePortals";
import { useI18n } from "@/i18n/I18nProvider";
import BookingDetailPanel from "@/components/BookingDetailPanel";
import { PujaTitle } from "@/components/PujaTitle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { apiBookings } from "@/lib/api";
import {
  displayStatus,
  formatPaise,
  compareByPujaSchedule,
  isExpiredBooking,
  isUpcomingBooking,
  mapApiBooking,
  statusBadgeClass,
  type PujariBookingRow,
} from "@/lib/pujariBookings";
import { Calendar as CalendarIcon, Clock, MapPin, Sparkles } from "lucide-react";
import { formatDisplayDate } from "@/lib/formatDate";
import { toast } from "sonner";
import { pujarisIncludedShort, pujariTeamAcceptNotice } from "@/lib/pujariTeam";

type Segment = "all" | "upcoming" | "completed" | "cancelled" | "expired";
type StatusFilter =
  | "all"
  | "pending"
  | "pending_acceptance"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";

function parseQuery(search: string) {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const segment = (q.get("tab") || q.get("segment") || "all") as Segment;
  return {
    segment: (
      ["all", "upcoming", "completed", "cancelled", "expired"].includes(segment) ? segment : "all"
    ) as Segment,
    status: (q.get("status") || "all") as StatusFilter,
    q: q.get("q") || "",
    from: q.get("from") || "",
    to: q.get("to") || "",
  };
}

export default function PujariBookingsPage() {
  const { t } = useI18n();
  const search = useSearch();
  const initial = parseQuery(search);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState<Segment>(initial.segment);
  const [status, setStatus] = useState<StatusFilter>(initial.status);
  const [q, setQ] = useState(initial.q);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [selected, setSelected] = useState<PujariBookingRow | null>(null);
  const [detailIntent, setDetailIntent] = useState<"accept" | "reject" | null>(null);

  async function load() {
    setLoading(true);
    try {
      // API allows limit 1–100 only; higher values return 422 and empty the list
      const res = await apiBookings(1, 100);
      setBookings(res.items || []);
    } catch (e: any) {
      setBookings([]);
      toast.error(e.message || t("web.booking.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const next = parseQuery(search);
    setSegment(next.segment);
    setStatus(next.status);
    setQ(next.q);
    setFrom(next.from);
    setTo(next.to);
  }, [search]);

  const rows = useMemo(() => (bookings || []).map(mapApiBooking), [bookings]);
  const now = new Date();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (segment === "upcoming") return isUpcomingBooking(r, now);
        if (segment === "completed") return r.booking.status === "completed";
        if (segment === "cancelled") return ["cancelled", "refunded"].includes(r.booking.status);
        if (segment === "expired") return isExpiredBooking(r, now);
        return true;
      })
      .filter((r) => {
        if (status === "all") return true;
        if (status === "expired") return isExpiredBooking(r, now);
        if (status === "pending") {
          return ["pending", "pending_acceptance"].includes(r.booking.status) && !isExpiredBooking(r, now);
        }
        const shown = displayStatus(r, now);
        return shown === status || r.booking.status === status;
      })
      .filter((r) => {
        if (!from && !to) return true;
        const d = r.booking.bookingDate ? String(r.booking.bookingDate).slice(0, 10) : "";
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      })
      .filter((r) => {
        if (!needle) return true;
        const hay = [
          r.pujaType.name,
          r.booking.bookingNumber,
          r.booking.city,
          r.booking.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => {
        if (segment === "upcoming" || status === "pending") {
          return compareByPujaSchedule(a, b, "asc");
        }
        return compareByPujaSchedule(a, b, "desc");
      });
  }, [rows, segment, status, q, from, to]);

  function openDetail(row: PujariBookingRow, intent: "accept" | "reject" | null = null) {
    setDetailIntent(intent);
    setSelected(row);
  }

  function clearFilters() {
    setSegment("all");
    setStatus("all");
    setQ("");
    setFrom("");
    setTo("");
  }

  return (
    <PujariPortal>
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">{t("nav.bookings")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("web.pujariBookings.description")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-1 lg:col-span-2">
              <Label>{t("common.search")}</Label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("web.pujariBookings.searchPlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("web.pujariBookings.list")}</Label>
              <Select value={segment} onValueChange={(v) => setSegment(v as Segment)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="upcoming">{t("web.pujariBookings.upcoming")}</SelectItem>
                  <SelectItem value="completed">{t("status.completed")}</SelectItem>
                  <SelectItem value="cancelled">{t("status.cancelled")}</SelectItem>
                  <SelectItem value="expired">{t("web.status.expired")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("common.status")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("web.pujariBookings.allStatuses")}</SelectItem>
                  <SelectItem value="pending">{t("status.pending")}</SelectItem>
                  <SelectItem value="confirmed">{t("status.confirmed")}</SelectItem>
                  <SelectItem value="in_progress">{t("status.in_progress")}</SelectItem>
                  <SelectItem value="completed">{t("status.completed")}</SelectItem>
                  <SelectItem value="expired">{t("web.status.expired")}</SelectItem>
                  <SelectItem value="cancelled">{t("status.cancelled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("common.from")}</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("common.to")}</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              {t("web.pujariBookings.clearFilters")}
            </Button>
            <p className="text-sm text-muted-foreground self-center">
              {loading ? t("common.loading") : t("web.pujariBookings.count", { count: filtered.length })}
            </p>
          </div>

          {loading && <Skeleton className="h-24 w-full" />}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center max-w-md mx-auto leading-relaxed">
              {t("web.pujariBookings.none")}
            </p>
          )}
          {!loading && rows.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("web.pujariBookings.noMatches")}
            </p>
          )}
          <div className="space-y-3">
            {filtered.map((row) => {
              const shown = displayStatus(row, now);
              const canAccept = ["pending", "pending_acceptance"].includes(row.booking.status) && !isExpiredBooking(row, now);
              return (
                <div
                  key={row.booking.id}
                  className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-secondary/30 transition-colors"
                >
                  <button type="button" className="w-full text-left" onClick={() => openDetail(row)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
                          <PujaTitle name={row.pujaType.name} className="min-w-0" nameClassName="truncate" />
                          {row.booking.offerInvited ? (
                            <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[10px] uppercase tracking-wide">
                              {row.booking.offerDistanceKm != null
                                ? t("web.pujariBookings.openDistance", { distance: row.booking.offerDistanceKm })
                                : t("web.pujariBookings.openRequest")}
                            </Badge>
                          ) : null}
                          {row.booking.samagriRequested ? (
                            <Badge className="bg-orange-100 text-orange-900 border-orange-200 text-[10px] uppercase tracking-wide">
                              {t("web.pujariBookings.samagriSelected")}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">#{row.booking.bookingNumber}</p>
                        <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1">
                            <CalendarIcon size={14} />
                            {row.booking.bookingDate
                              ? formatDisplayDate(row.booking.bookingDate)
                              : "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {row.booking.indiaLocal || row.booking.bookingTime || "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin size={14} />
                            {row.booking.city || "—"}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-primary mt-2">
                          {t("web.services.dakshina", { amount: formatPaise(row.booking.priestAmount || 0) })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {row.booking.pujarisIncludedLabel ||
                            pujarisIncludedShort(row.booking.pujarisRequired || 1, t)}
                        </p>
                        {canAccept &&
                        (row.booking.pujarisRequired || 1) > 1 &&
                        pujariTeamAcceptNotice(row.booking.pujarisRequired || 1, t) ? (
                          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
                            {pujariTeamAcceptNotice(row.booking.pujarisRequired || 1, t)}
                          </p>
                        ) : null}
                      </div>
                      <Badge className={statusBadgeClass(shown)}>{shown === "expired" ? t("web.status.expired") : t(`status.${shown}`)}</Badge>
                    </div>
                  </button>
                  {canAccept && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/60">
                      <Button size="sm" onClick={() => openDetail(row, "accept")}>
                        {t("web.pujariBookings.accept")}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => openDetail(row, "reject")}>
                        {t("web.pujariBookings.reject")}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setDetailIntent(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {detailIntent === "reject" ? (
                t("web.pujariBookings.rejectBooking")
              ) : selected ? (
                <PujaTitle name={selected.pujaType.name} as="span" />
              ) : null}
            </DialogTitle>
            <DialogDescription>#{selected?.booking.bookingNumber}</DialogDescription>
          </DialogHeader>
          {selected && (
            <BookingDetailPanel
              bookingId={selected.booking.id}
              role="pujari"
              initialIntent={detailIntent}
              seed={{
                status: selected.booking.status,
                service_name: selected.booking.serviceName,
                booking_number: selected.booking.bookingNumber,
                booking_date: selected.booking.bookingDate
                  ? String(selected.booking.bookingDate).slice(0, 10)
                  : undefined,
                start_time: selected.booking.bookingTime || undefined,
                location_label: selected.booking.location,
                package_type: selected.booking.tier,
                base_price_paise: selected.booking.basePrice,
                platform_fee_paise: selected.booking.platformFee,
                gst_amount_paise: selected.booking.gstAmount,
                total_paise: selected.booking.totalAmount,
                pujari_payable_paise: selected.booking.priestAmount,
                customer_name: selected.customer.name || undefined,
                pujaris_required: selected.booking.pujarisRequired,
                pujaris_included_label: selected.booking.pujarisIncludedLabel,
              }}
              onUpdated={async (info) => {
                await load();
                if (
                  info?.decision === "accepted" ||
                  info?.decision === "rejected" ||
                  info?.decision === "cancelled"
                ) {
                  setSelected(null);
                  setDetailIntent(null);
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </PujariPortal>
  );
}
