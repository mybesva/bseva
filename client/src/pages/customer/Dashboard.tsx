import Layout from "@/components/Layout";
import RolePortalGate from "@/components/RolePortalGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  CreditCard,
  ArrowRight,
  LogOut,
  Star,
  Award,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useMemo, useState } from "react";
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
  const { data: bookings, isLoading } = trpc.bookings.getMyBookings.useQuery(undefined, {
    enabled: !!user && user.role === "customer",
  });
  const { data: categories } = trpc.services.getCategories.useQuery();
  const firstCategoryId = categories?.[0]?.id;
  const { data: pujas } = trpc.services.getPujasByCategory.useQuery(
    { categoryId: firstCategoryId! },
    { enabled: !!firstCategoryId }
  );
  const { data: priestRows = [] } = trpc.priests.getAll.useQuery({});
  const { data: panchang } = trpc.calendar.panchangam.useQuery({
    date: new Date(),
    calendarType: calPref,
  });
  const setPref = trpc.calendar.setPreference.useMutation();

  const pujariCards = useMemo(() => {
    return priestRows.map(({ user: u, profile }, index) => ({
      id: u.id,
      name: u.name || "Pujari",
      image: ["/images/temple-ritual.png", "/images/puja-thali.png", "/images/hero-bg.png", "/images/meditation.png"][
        index % 4
      ],
      location: `${profile.locationCity || u.city || "India"}${
        profile.locationArea ? ` (${profile.locationArea})` : ""
      }`,
      experience: `${profile.experience}+ Years`,
      rating: Number(profile.rating || 0),
      reviews: profile.totalReviews || 0,
      languages: (profile.languages as string[]) || [],
      specializations: (profile.specializations as string[]) || [],
      verified: !!profile.isVerified,
      available: profile.availabilityStatus === "available",
    }));
  }, [priestRows]);

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

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    setLocation("/customer");
  };

  return (
    <Layout>
      <section className="bg-sidebar text-sidebar-foreground py-12">
        <div className="container flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">
              {t("customer.welcome")}, {user?.name || "Customer"}
            </h1>
            <p className="text-sidebar-foreground/80">
              {t("customer.subtitle")}
            </p>
          </div>
          <Button
            variant="outline"
            className="bg-transparent border-sidebar-foreground/30 text-sidebar-foreground hover:bg-sidebar-accent gap-2"
            onClick={handleLogout}
          >
            <LogOut size={16} /> Logout
          </Button>
        </div>
      </section>

      <div className="container py-10 space-y-12">
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
                    setPref.mutate({ pref });
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
                  <p className="text-xs text-muted-foreground">{panchang.notes}</p>
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
                  <p className="text-sm text-muted-foreground line-clamp-2">{puja.shortDescription}</p>
                  <div className="text-sm font-medium text-sidebar">
                    From ₹{((puja.basePriceStandard || 0) / 100).toLocaleString("en-IN")}
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

        {/* Pujari info cards — no Book Now (customers book services above) */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-2xl font-bold text-sidebar">{t("customer.verifiedPujaris")}</h2>
            <p className="text-sm text-muted-foreground">{t("customer.autoAssign")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pujariCards.map((pujari) => (
              <Card key={pujari.id} className="overflow-hidden border-border shadow-sm">
                <div className="relative h-40 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                  <img src={pujari.image} alt={pujari.name} className="w-full h-full object-cover" />
                  <div className="absolute bottom-3 left-3 z-20 text-white">
                    <div className="flex items-center gap-1 font-bold">
                      {pujari.name}
                      {pujari.verified && <CheckCircle2 size={14} className="text-primary fill-white" />}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-white/80">
                      <MapPin size={12} /> {pujari.location}
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 z-20 bg-white/90 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 text-sidebar">
                    <Star size={12} className="fill-primary text-primary" /> {pujari.rating} ({pujari.reviews})
                  </div>
                </div>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Award size={16} className="text-primary" />
                    Experience: <span className="text-sidebar font-medium">{pujari.experience}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {pujari.specializations.slice(0, 3).map((spec) => (
                      <Badge key={spec} variant="outline" className="border-primary/30 text-sidebar font-normal">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                  <Badge
                    variant="secondary"
                    className={pujari.available ? "bg-green-100 text-green-800" : "bg-muted"}
                  >
                    {pujari.available ? "Available" : "Busy"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* My bookings */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-2xl font-bold text-sidebar">{t("customer.myBookings")}</h2>
            <Link href="/my-bookings">
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
            {(bookings || []).slice(0, 5).map(({ booking, pujaType }) => (
              <Card key={booking.id} className="border-border">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-heading font-semibold text-lg text-sidebar">{pujaType.name}</h3>
                        <Badge className={getStatusColor(booking.status)}>{booking.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">#{booking.bookingNumber}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {booking.bookingDate
                            ? format(new Date(booking.bookingDate), "dd MMM yyyy")
                            : "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {booking.bookingTime || "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={14} />
                          {booking.city || booking.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <CreditCard size={14} />
                          ₹{((booking.totalAmount || 0) / 100).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">{booking.tier}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function CustomerDashboard() {
  return (
    <RolePortalGate role="customer">
      <CustomerDashboardContent />
    </RolePortalGate>
  );
}
