import { CustomerPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  CreditCard,
  ArrowRight,
  PlayCircle,
} from "lucide-react";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import WalletPanel from "@/components/WalletPanel";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function CustomerDashboardContent() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [calPref, setCalPref] = useState<"north" | "south" | "lunar">("north");
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pujas, setPujas] = useState<any[]>([]);
  const [panchang, setPanchang] = useState<any>(null);

  useEffect(() => {
    const pref = (user?.calendar_preference as "north" | "south" | "lunar") || "north";
    setCalPref(pref);
  }, [user?.calendar_preference]);

  useEffect(() => {
    const qs = new URLSearchParams({ date: format(new Date(), "yyyy-MM-dd"), calendar: calPref });
    api(`/panchang?${qs}`).then(setPanchang).catch(() => setPanchang(null));
  }, [calPref]);

  useEffect(() => {
    if (!user || user.role !== "customer") return;
    setIsLoading(true);
    Promise.all([
      api<any[]>("/bookings"),
      api<any[]>("/services"),
    ])
      .then(([b, s]) => {
        setBookings(b);
        setPujas(s);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setIsLoading(false));
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-100 text-green-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "in_progress": return "bg-blue-100 text-blue-800";
      case "completed": return "bg-gray-100 text-gray-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const ongoingBookings = useMemo(
    () => (bookings || []).filter((b) => b.status === "in_progress"),
    [bookings]
  );

  return (
    <>
      <section className="bg-sidebar text-sidebar-foreground py-10 px-6 rounded-xl mb-8">
        <h1 className="font-heading text-3xl font-bold mb-2">{t("customer.welcome")}, {user?.name || "Customer"}</h1>
        <p className="text-sidebar-foreground/80">{t("customer.subtitle")}</p>
      </section>
      <div className="space-y-12">
        {!isLoading && ongoingBookings.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-2xl font-bold text-sidebar flex items-center gap-2">
                <PlayCircle className="text-blue-600" size={22} />
                {t("customer.ongoingPuja")}
              </h2>
              <Link href="/customer/bookings">
                <Button variant="outline" size="sm">{t("common.viewAll")}</Button>
              </Link>
            </div>
            <div className="space-y-4">
              {ongoingBookings.map((booking) => (
                <Card key={booking.id} className="border-2 border-blue-200 bg-blue-50/40 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-heading font-semibold text-lg text-sidebar">{booking.service_name}</h3>
                          <Badge className={getStatusColor(booking.status)}>{booking.status.replace("_", " ")}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">#{booking.booking_number}</p>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {booking.booking_date || "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {booking.start_time || "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin size={14} />
                            {booking.location_label || booking.mode}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize self-start md:self-center">{booking.package_type}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WalletPanel variant="customer" />
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">{t("calendar.panchangam")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">{t("calendar.preference")}</Label>
                <Select
                  value={calPref}
                  onValueChange={(v) => {
                    const pref = v as "north" | "south" | "lunar";
                    setCalPref(pref);
                    void api("/auth/me", { method: "PATCH", body: JSON.stringify({ calendar_preference: pref }) });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="north">{t("calendar.north")}</SelectItem>
                    <SelectItem value="south">{t("calendar.south")}</SelectItem>
                    <SelectItem value="lunar">{t("calendar.lunar")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {panchang && (
                <div className="text-sm space-y-1 bg-orange-50 border border-orange-100 rounded-lg p-3">
                  <p><strong>Tithi:</strong> {panchang.tithi} ({panchang.paksha})</p>
                  <p><strong>Nakshatra:</strong> {panchang.nakshatra}</p>
                  <p><strong>Month:</strong> {panchang.lunarMonth} · Day {panchang.lunarDay}</p>
                  <p><strong>Rahu Kalam:</strong> {panchang.rahukaalam}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Booking cards — services */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-2xl font-bold text-sidebar">{t("customer.bookServices")}</h2>
            <Link href="/services">
              <Button variant="outline" className="gap-2">
                View All <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(pujas || []).slice(0, 6).map((puja) => (
              <Card key={puja.id} className="hover:shadow-md transition-shadow border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="font-heading text-lg text-sidebar flex items-center gap-2">
                    <Sparkles className="text-primary" size={18} />
                    {puja.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">{puja.description}</p>
                  <div className="text-sm font-medium text-sidebar">
                    From ₹{((puja.standard_price_paise || 0) / 100).toLocaleString("en-IN")}
                  </div>
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 font-bold"
                    onClick={() => setLocation(`/book/${puja.slug}`)}
                  >
                    {t("customer.bookNow")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* My bookings */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-2xl font-bold text-sidebar">{t("customer.myBookings")}</h2>
            <Link href="/customer/bookings">
              <Button variant="outline">{t("common.viewAll")}</Button>
            </Link>
          </div>
          {isLoading && <Skeleton className="h-32 w-full" />}
          {!isLoading && (!bookings || bookings.length === 0) && (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground mb-4">No bookings yet. Book a service above to get started.</p>
              </CardContent>
            </Card>
          )}
          <div className="space-y-4">
            {(bookings || [])
              .filter((b) => b.status !== "in_progress")
              .slice(0, 5)
              .map((booking) => (
              <Card key={booking.id} className="border-border">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-heading font-semibold text-lg text-sidebar">{booking.service_name}</h3>
                        <Badge className={getStatusColor(booking.status)}>{booking.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">#{booking.booking_number}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {booking.booking_date || "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {booking.start_time || "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={14} />
                          {booking.location_label || booking.mode}
                        </span>
                        <span className="flex items-center gap-1">
                          <CreditCard size={14} />
                          ₹{((booking.total_paise || 0) / 100).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">{booking.package_type}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function CustomerDashboard() {
  return (
    <CustomerPortal>
      <CustomerDashboardContent />
    </CustomerPortal>
  );
}
