import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { PujariPortal } from "@/components/RolePortals";
import BookingDetailPanel from "@/components/BookingDetailPanel";
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
  isExpiredBooking,
  isPastBooking,
  isUpcomingBooking,
  mapApiBooking,
  statusBadgeClass,
  type PujariBookingRow,
} from "@/lib/pujariBookings";
import { Calendar as CalendarIcon, Clock, MapPin, Sparkles, User } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Segment = "all" | "upcoming" | "completed";
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
    segment: (["all", "upcoming", "completed"].includes(segment) ? segment : "all") as Segment,
    status: (q.get("status") || "all") as StatusFilter,
    q: q.get("q") || "",
    from: q.get("from") || "",
    to: q.get("to") || "",
  };
}

export default function PujariBookingsPage() {
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
      const res = await apiBookings(1, 200);
      setBookings(res.items || []);
    } catch (e: any) {
      toast.error(e.message || "Could not load bookings");
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
        if (segment === "completed") return isPastBooking(r, now);
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
          r.customer.name,
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
        const ta = new Date(a.booking.bookingDate || 0).getTime();
        const tb = new Date(b.booking.bookingDate || 0).getTime();
        return segment === "completed" ? tb - ta : ta - tb;
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
          <CardTitle className="text-2xl">Bookings</CardTitle>
          <p className="text-sm text-muted-foreground">
            Filter by status, date, or search. Expired confirmed pujas appear under Completed.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-1 lg:col-span-2">
              <Label>Search</Label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Service, customer, booking #"
              />
            </div>
            <div className="space-y-1">
              <Label>List</Label>
              <Select value={segment} onValueChange={(v) => setSegment(v as Segment)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="completed">Completed / past</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
            <p className="text-sm text-muted-foreground self-center">
              {loading ? "Loading…" : `${filtered.length} booking${filtered.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {loading && <Skeleton className="h-24 w-full" />}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">No bookings match your filters.</p>
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
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <Sparkles size={16} className="text-primary shrink-0" />
                          <span className="truncate">{row.pujaType.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">#{row.booking.bookingNumber}</p>
                        <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1">
                            <CalendarIcon size={14} />
                            {row.booking.bookingDate
                              ? format(new Date(row.booking.bookingDate), "dd MMM yyyy")
                              : "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {row.booking.bookingTime || "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <User size={14} />
                            {row.customer.name || "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin size={14} />
                            {row.booking.city || "—"}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-primary mt-2">
                          Dakshina: {formatPaise(row.booking.priestAmount || 0)}
                        </div>
                      </div>
                      <Badge className={statusBadgeClass(shown)}>{shown.replace(/_/g, " ")}</Badge>
                    </div>
                  </button>
                  {canAccept && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/60">
                      <Button size="sm" onClick={() => openDetail(row, "accept")}>
                        Accept
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => openDetail(row, "reject")}>
                        Reject
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
              {detailIntent === "reject" ? "Reject booking" : selected?.pujaType.name}
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
              }}
              onUpdated={async (info) => {
                await load();
                if (info?.decision === "accepted" || info?.decision === "rejected") {
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
