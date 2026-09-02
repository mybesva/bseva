import { useEffect, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, rupees } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Calendar, Clock, MapPin, Printer, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

function statusColor(status: string) {
  switch (status) {
    case "confirmed":
    case "accepted":
      return "bg-green-100 text-green-800";
    case "pending":
    case "pending_acceptance":
      return "bg-yellow-100 text-yellow-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "completed":
      return "bg-gray-100 text-gray-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function BookingReceipt() {
  const params = useParams<{ id: string }>();
  const search = useSearch();
  const qs = new URLSearchParams(search);
  const idOrNumber = params.id || qs.get("number") || "";
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [booking, setBooking] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLocation(
        getLoginUrl({
          role: "customer",
          returnPath: idOrNumber ? `/booking/${idOrNumber}` : "/my-bookings",
        })
      );
      return;
    }
    if (!idOrNumber) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api<any>(`/bookings/${encodeURIComponent(idOrNumber)}`)
      .then(setBooking)
      .catch((e) => {
        toast.error(e.message || "Could not load booking");
        setBooking(null);
      })
      .finally(() => setLoading(false));
  }, [user, authLoading, idOrNumber, setLocation]);

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!booking) {
    return (
      <Layout>
        <div className="container py-16 text-center space-y-4">
          <h1 className="font-heading text-2xl font-bold">Booking not found</h1>
          <Button onClick={() => setLocation("/customer/bookings")}>My Bookings</Button>
        </div>
      </Layout>
    );
  }

  const showPujari = booking.pujari_details_visible === true && !!booking.pujari_name;
  const slot = `${booking.booking_date || "—"} · ${booking.start_time || "—"}`;

  return (
    <Layout>
      <div className="container max-w-3xl py-10 print:py-4">
        <div className="flex flex-wrap gap-2 mb-6 print:hidden">
          <Button variant="outline" size="sm" onClick={() => setLocation("/customer/bookings")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> My Bookings
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> Print receipt
          </Button>
        </div>

        <Card className="border-2 border-primary/30 shadow-md print:shadow-none print:border">
          <CardHeader className="border-b bg-secondary/20 print:bg-transparent">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Booking receipt</p>
                <CardTitle className="font-heading text-2xl mt-1">{booking.service_name || "Puja"}</CardTitle>
              </div>
              <Badge className={statusColor(String(booking.status || ""))}>
                {String(booking.status || "").replace(/_/g, " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6 text-sm">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground">Booking ID</p>
                <p className="font-mono font-semibold text-base">{booking.booking_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Internal ref</p>
                <p className="font-mono text-xs break-all">{booking.id}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Puja / Service</p>
                <p className="font-medium">{booking.service_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Package</p>
                <p className="font-medium capitalize">{booking.package_type || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Calendar size={14} /> Booking date
                </p>
                <p className="font-medium">{booking.booking_date || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Clock size={14} /> Booking time
                </p>
                <p className="font-medium">{booking.start_time || "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Puja slot (date & time)</p>
                <p className="font-semibold text-base">{slot}</p>
                {booking.end_time && (
                  <p className="text-xs text-muted-foreground mt-0.5">Ends approx. {booking.end_time}</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">Mode</p>
                <p className="font-medium capitalize">{String(booking.mode || "").replace(/_/g, " ") || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <MapPin size={14} /> Location
                </p>
                <p className="font-medium">{booking.location_label || booking.address || "—"}</p>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="font-heading font-semibold">Payment</h3>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{String(booking.payment_status || "—").replace(/_/g, " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base</span>
                <span>{rupees(booking.base_price_paise)}</span>
              </div>
              {Number(booking.peak_fee_paise || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Surge / peak</span>
                  <span>{rupees(booking.peak_fee_paise)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform fee</span>
                <span>{rupees(booking.platform_fee_paise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST ({booking.gst_percent ?? 18}%)</span>
                <span>{rupees(booking.gst_amount_paise)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total</span>
                <span>{rupees(booking.total_paise)}</span>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="font-heading font-semibold">Booking status</h3>
              <p className="capitalize">{String(booking.status || "").replace(/_/g, " ")}</p>
              {booking.special_instructions && (
                <div>
                  <p className="text-muted-foreground text-xs">Special instructions</p>
                  <p>{booking.special_instructions}</p>
                </div>
              )}
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="font-heading font-semibold">Pujari</h3>
              {showPujari ? (
                <div className="space-y-1">
                  <p className="font-medium">{booking.pujari_name}</p>
                  {booking.pujari_phone && <p className="text-muted-foreground">{booking.pujari_phone}</p>}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {booking.pujari_reveal_note ||
                    "Pujari details will be shared within 24 hours before your scheduled puja."}
                </p>
              )}
            </div>

            {Array.isArray(booking.samagri) && booking.samagri.length > 0 && (
              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="font-heading font-semibold">Recommended List</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {booking.samagri.map((it: any, i: number) => (
                    <li key={i}>
                      {it.name}
                      {it.required ? " (required)" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="print:hidden flex flex-wrap gap-2 pt-2">
              <Button onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-1" /> Print
              </Button>
              <Button variant="outline" onClick={() => setLocation("/customer/bookings")}>
                Back to My Bookings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
