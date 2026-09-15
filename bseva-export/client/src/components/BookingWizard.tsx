import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogIn,
  MapPin,
} from "lucide-react";
import { format } from "date-fns";
import { formatDisplayDate } from "@/lib/formatDate";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { MapLocationPicker, type AddressValue } from "@/components/AddressFields";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useI18n } from "@/i18n/I18nProvider";
import { policyBySlug, useLegalPolicies } from "@/hooks/useLegalPolicies";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { friendlyBookingError, isServiceAreaUnavailableError, COMING_SOON_TITLE, COMING_SOON_BODY } from "@/lib/serviceAvailabilityMessages";
import { useServiceAvailability } from "@/lib/ServiceAvailabilityContext";
import { isDeathRelatedService } from "@/lib/serviceCategories";

interface BookingWizardProps {
  serviceId: string;
  pujaName: string;
  serviceCategories?: { slug?: string; name?: string }[];
  basePrices: {
    basic?: number;
    standard: number;
    premium: number;
  };
  /** Optional reimbursable add-on list prices (paise) */
  addonPrices?: {
    samagri?: number | null;
    alankaram?: number | null;
    food?: number | null;
    samagriAvailable?: boolean;
    alankaramAvailable?: boolean;
    foodAvailable?: boolean;
  };
}

type BookingStep = 1 | 2 | 3 | 4;
type Tier = "basic" | "standard" | "premium";
type ServiceMode = "physical" | "virtual";
type CalendarType = "north" | "south" | "lunar";

export default function BookingWizard({
  serviceId,
  pujaName,
  serviceCategories,
  basePrices,
  addonPrices,
}: BookingWizardProps) {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { refresh: refreshServiceAvailability } = useServiceAvailability();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { policies: legalPolicies } = useLegalPolicies([
    "booking_terms",
    "cancellation_policy",
  ]);
  const bookingTerms = policyBySlug(legalPolicies, "booking_terms");
  const cancellationPolicy = policyBySlug(legalPolicies, "cancellation_policy");
  const [currentStep, setCurrentStep] = useState<BookingStep>(1);
  const [tier, setTier] = useState<Tier>("standard");
  const [serviceMode, setServiceMode] = useState<ServiceMode>("physical");
  const [calendarType, setCalendarType] = useState<CalendarType>("north");
  const [bookingDate, setBookingDate] = useState<Date | undefined>();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [bookingTime, setBookingTime] = useState("10:00");
  const [locationText, setLocationText] = useState("");
  const [doorNumber, setDoorNumber] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [addressMode, setAddressMode] = useState<"saved" | "new">("new");
  const [savedAddress, setSavedAddress] = useState<{
    label: string;
    city: string;
    lat: number | null;
    lng: number | null;
  } | null>(null);
  const [savedAddressLoading, setSavedAddressLoading] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [includeSamagri, setIncludeSamagri] = useState(false);
  const [includeAlankaram, setIncludeAlankaram] = useState(false);
  const [includeFood, setIncludeFood] = useState(false);
  const [addonConfirm, setAddonConfirm] = useState<null | "samagri" | "alankaram" | "food">(null);
  const [wallet, setWallet] = useState<{ balance?: number; wallet?: { balance_paise: number } } | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [panchang, setPanchang] = useState<any>(null);
  const [recurring, setRecurring] = useState<"none" | "weekly" | "monthly" | "selected_dates">("none");
  const [recurringCount, setRecurringCount] = useState(4);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [extraDate, setExtraDate] = useState<Date | undefined>();
  const [extraDatePickerOpen, setExtraDatePickerOpen] = useState(false);
  const { config: publicConfig } = usePublicConfig();
  const settings = {
    virtualPujaEnabled: publicConfig.virtual_puja_enabled ? "true" : "false",
    gstPercent: "18",
  };

  useEffect(() => {
    if (!bookingDate) {
      setPanchang(null);
      return;
    }
    const qs = new URLSearchParams({ date: format(bookingDate, "yyyy-MM-dd"), calendar: calendarType });
    api(`/panchang?${qs}`)
      .then(setPanchang)
      .catch(() => setPanchang(null));
  }, [bookingDate, calendarType]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api<{ wallet: { balance_paise: number } }>("/wallet")
      .then((w) => setWallet({ balance: w.wallet.balance_paise, wallet: w.wallet }))
      .catch(() => setWallet(null));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "customer") {
      setSavedAddress(null);
      setAddressMode("new");
      return;
    }
    setSavedAddressLoading(true);
    api<any>("/customer/profile")
      .then((p) => {
        const parts = [
          p.address_line1,
          p.address_line2,
          p.city,
          p.district,
          p.state,
          p.pincode,
        ]
          .map((x: unknown) => String(x || "").trim())
          .filter(Boolean);
        const label =
          String(p.location_label || "").trim() ||
          String(p.address || "").trim() ||
          parts.join(", ");
        const profileCity = String(p.city || "").trim();
        if (!label && !profileCity) {
          setSavedAddress(null);
          setAddressMode("new");
          return;
        }
        const saved = {
          label: label || profileCity,
          city: profileCity,
          lat: p.latitude != null ? Number(p.latitude) : null,
          lng: p.longitude != null ? Number(p.longitude) : null,
        };
        setSavedAddress(saved);
        setAddressMode("saved");
        setLocationText(saved.label);
        setCity(saved.city);
        setLat(saved.lat);
        setLng(saved.lng);
      })
      .catch(() => {
        setSavedAddress(null);
        setAddressMode("new");
      })
      .finally(() => setSavedAddressLoading(false));
  }, [isAuthenticated, user?.role]);

  function applySavedAddress() {
    if (!savedAddress) return;
    setAddressMode("saved");
    setLocationText(savedAddress.label);
    setDoorNumber("");
    setLandmark("");
    setCity(savedAddress.city);
    setLat(savedAddress.lat);
    setLng(savedAddress.lng);
    setGeoError(null);
  }

  function startNewAddress() {
    setAddressMode("new");
    setLocationText("");
    setDoorNumber("");
    setLandmark("");
    setCity("");
    setLat(null);
    setLng(null);
    setGeoError(null);
  }

  function composedServiceAddress() {
    if (addressMode === "saved") return locationText.trim();
    return [doorNumber.trim(), locationText.trim(), landmark.trim()].filter(Boolean).join(", ");
  }

  useEffect(() => {
    if (!bookingDate) return;
    const qs = new URLSearchParams({
      service_id: serviceId,
      package_type: tier,
      city: city || "",
      booking_date: format(bookingDate, "yyyy-MM-dd"),
      include_samagri: includeSamagri ? "true" : "false",
      include_alankaram: includeAlankaram ? "true" : "false",
      include_food: includeFood ? "true" : "false",
    });
    api(`/quote?${qs}`)
      .then(setQuote)
      .catch(() => setQuote(null));
  }, [bookingDate, serviceId, tier, city, includeSamagri, includeAlankaram, includeFood]);

  const samagriPrice = Number(addonPrices?.samagri || quote?.samagriListPrice || 0);
  const alankaramPrice = Number(addonPrices?.alankaram || quote?.alankaramListPrice || 0);
  const foodPrice = Number(addonPrices?.food || quote?.foodListPrice || 0);
  const foodAvailable = Boolean(addonPrices?.foodAvailable);
  const deathRelated = isDeathRelatedService(serviceCategories);
  const showSamagri = Boolean(addonPrices?.samagriAvailable) && samagriPrice > 0;
  const alankaramOffered =
    !deathRelated && Boolean(addonPrices?.alankaramAvailable) && alankaramPrice > 0;
  const showAlankaramComingSoon = !deathRelated && !alankaramOffered;

  function formatAddonPrice(paise: number, selected: boolean): string {
    if (paise <= 0) return selected ? "Included in your booking total." : "Select to include in total";
    const amt = `₹${(paise / 100).toLocaleString("en-IN")}`;
    return selected
      ? `${amt} will be inclusive in your booking total.`
      : `${amt} · select to include in total`;
  }

  // Offer Samagri, Alankaram, and Food/Prasadam (when available) as customer opt-in.
  function requestAddon(kind: "samagri" | "alankaram" | "food", checked: boolean) {
    if (!checked) {
      if (kind === "samagri") setIncludeSamagri(false);
      else if (kind === "alankaram") setIncludeAlankaram(false);
      else setIncludeFood(false);
      return;
    }
    setAddonConfirm(kind);
  }

  function confirmAddon() {
    if (addonConfirm === "samagri") setIncludeSamagri(true);
    if (addonConfirm === "alankaram") setIncludeAlankaram(true);
    if (addonConfirm === "food") setIncludeFood(true);
    setAddonConfirm(null);
  }

  function AddonOptionsCard() {
    return (
      <>
        <Card className="border-dashed border-primary/50 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div>
              <p className="font-semibold text-foreground">
                {alankaramOffered || showAlankaramComingSoon
                  ? "Samagri & Alankaram (optional)"
                  : "Samagri (optional)"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tick if you want these arranged for your puja. The charge is added to your booking payment now;
                BSeva pays the pujari later. Leave unchecked if you will arrange yourself.
              </p>
            </div>
            {showSamagri && (
            <label
              className={cn(
                "flex items-start gap-3 rounded-md p-3 cursor-pointer transition-colors",
                includeSamagri
                  ? "border-[3px] border-primary bg-primary/10 shadow-sm"
                  : "border border-border bg-card hover:border-muted-foreground/40"
              )}
            >
              <Checkbox
                checked={includeSamagri}
                onCheckedChange={(v) => requestAddon("samagri", !!v)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2 flex-wrap">
                  <span className="font-medium">Samagri kit</span>
                  <span
                    className={cn(
                      "text-sm font-semibold shrink-0",
                      includeSamagri ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {formatAddonPrice(samagriPrice, includeSamagri)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Puja materials arranged for you — added to your booking payment when selected.
                </p>
              </div>
            </label>
            )}
            {alankaramOffered && (
              <label
                className={cn(
                  "flex items-start gap-3 rounded-md p-3 cursor-pointer transition-colors",
                  includeAlankaram
                    ? "border-[3px] border-primary bg-primary/10 shadow-sm"
                    : "border border-border bg-card hover:border-muted-foreground/40"
                )}
              >
                <Checkbox
                  checked={includeAlankaram}
                  onCheckedChange={(v) => requestAddon("alankaram", !!v)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2 flex-wrap">
                    <span className="font-medium">Alankaram</span>
                    <span
                      className={cn(
                        "text-sm font-semibold shrink-0",
                        includeAlankaram ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {formatAddonPrice(alankaramPrice, includeAlankaram)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Flowers and decoration arranged for your puja — added to your booking payment when selected.
                  </p>
                </div>
              </label>
            )}
            {showAlankaramComingSoon && (
              <div
                className="flex items-start gap-3 rounded-md p-3 border border-dashed border-border bg-muted/30 opacity-80"
                aria-disabled
              >
                <Checkbox checked={false} disabled className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2 flex-wrap">
                    <span className="font-medium text-muted-foreground">Alankaram</span>
                    <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 shrink-0">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Flowers and decoration will be available to add to your booking soon.
                  </p>
                </div>
              </div>
            )}
            {foodAvailable && (
              <label
                className={cn(
                  "flex items-start gap-3 rounded-md p-3 cursor-pointer transition-colors",
                  includeFood
                    ? "border-[3px] border-primary bg-primary/10 shadow-sm"
                    : "border border-border bg-card hover:border-muted-foreground/40"
                )}
              >
                <Checkbox
                  checked={includeFood}
                  onCheckedChange={(v) => requestAddon("food", !!v)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">Food / Prasadam</span>
                    <span className="font-semibold text-primary shrink-0">
                      {formatAddonPrice(foodPrice, includeFood)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Prasadam / food arrangement for this puja (when offered) — charged in your booking total.
                  </p>
                  {includeFood && (
                    <p className="text-xs font-semibold text-primary mt-1">
                      {formatAddonPrice(foodPrice, true)}
                    </p>
                  )}
                </div>
              </label>
            )}
            {(includeSamagri || includeAlankaram || includeFood) && (
              <div className="text-sm border-t pt-3 space-y-1">
                {includeSamagri && (
                  <div className="flex justify-between">
                    <span>Samagri charge</span>
                    <span>
                      {samagriPrice > 0
                        ? `₹${(samagriPrice / 100).toLocaleString("en-IN")}`
                        : "As priced"}
                    </span>
                  </div>
                )}
                {includeAlankaram && (
                  <div className="flex justify-between">
                    <span>Alankaram charge</span>
                    <span>
                      {alankaramPrice > 0
                        ? `₹${(alankaramPrice / 100).toLocaleString("en-IN")}`
                        : "As priced"}
                    </span>
                  </div>
                )}
                {includeFood && (
                  <div className="flex justify-between">
                    <span>Food / Prasadam charge</span>
                    <span>
                      {foodPrice > 0
                        ? `₹${(foodPrice / 100).toLocaleString("en-IN")}`
                        : "As priced"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span>Updated total</span>
                  <span className="text-primary">
                    ₹{(Number(bill.totalAmount || 0) / 100).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={!!addonConfirm} onOpenChange={(o) => !o && setAddonConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {addonConfirm === "food" ? "Add Food / Prasadam?" : "Add Samagri to your booking?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2 text-left">
                <span className="block">
                  {(addonConfirm === "food" ? foodPrice : samagriPrice) > 0
                    ? `₹${((addonConfirm === "food" ? foodPrice : samagriPrice) / 100).toLocaleString("en-IN")} will be inclusive in your booking total.`
                    : "The charge will be added to your booking total."}
                </span>
                <span className="block text-muted-foreground">
                  {addonConfirm === "food"
                    ? "Food / Prasadam will be arranged as part of your booking."
                    : "BSeva arranges puja materials; you pay now as part of your booking payment."}
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmAddon}>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  const tierDetails = {
    basic: {
      name: t("booking.basic"),
      description: "Essential rites for a focused home ceremony",
      features: ["Core rites as per the chosen service", "About 1.5–2 hours", "Essential guidance"],
    },
    standard: {
      name: t("booking.standard"),
      description: "Traditional home puja with essential samagri",
      features: ["Core rites as per the chosen service", "Essential samagri kit", "About 2 hours", "Guidance after the puja"],
    },
    premium: {
      name: t("booking.premium"),
      description: "Extended ceremony with deluxe kit and prasad",
      features: ["Full ceremonial rites", "Deluxe samagri kit", "About 3 hours", "Video of the ceremony", "Prasad packed for family"],
    },
  };

  const availableTiers = (Object.keys(tierDetails) as Tier[]).filter((key) => {
    if (key === "basic") return Number(basePrices.basic || 0) > 0;
    return Number(basePrices[key] || 0) > 0;
  });

  const steps = [
    { number: 1, title: t("booking.package") },
    { number: 2, title: t("booking.details") },
    { number: 3, title: t("booking.review") },
    { number: 4, title: t("booking.payment") },
  ];

  const virtualEnabled = settings?.virtualPujaEnabled !== "false";

  useEffect(() => {
    if (!virtualEnabled && serviceMode === "virtual") {
      setServiceMode("physical");
    }
  }, [virtualEnabled, serviceMode]);

  const bill = useMemo(() => {
    if (quote) {
      return {
        ...quote,
        basePrice: quote.basePrice ?? quote.mainPuja,
        samagri: quote.samagri ?? 0,
        alankaram: quote.alankaram ?? 0,
        foodPrasadam: quote.foodPrasadam ?? quote.food ?? 0,
        peakFee: quote.peakFee ?? 0,
        subtotal: quote.subtotal ?? quote.totalAmount,
        gstPercent: quote.gstPercent ?? Number(settings?.gstPercent || 18),
        gstAmount: quote.gstAmount ?? 0,
        totalAmount: quote.totalAmount ?? quote.total ?? 0,
      };
    }
    const base = Number(basePrices[tier] || basePrices.standard || 0);
    return {
      basePrice: base,
      peakFee: 0,
      subtotal: base,
      gstPercent: Number(settings?.gstPercent || 18),
      gstAmount: Math.floor((base * Number(settings?.gstPercent || 18)) / 100),
      totalAmount: base + Math.floor((base * Number(settings?.gstPercent || 18)) / 100),
      isPeakDay: false,
    };
  }, [quote, basePrices, tier, settings]);

  const canProceed = () => {
    if (currentStep === 1) return !!tier && !!serviceMode;
    if (currentStep === 2) {
      const addr = composedServiceAddress();
      if (addressMode === "new") {
        return !!(bookingDate && doorNumber.trim() && locationText.trim() && city.trim() && lat != null && lng != null);
      }
      return !!(bookingDate && addr && city.trim());
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!bookingDate) {
      toast.error("Please select a booking date");
      return;
    }
    if (lat == null || lng == null) {
      toast.error("Please set the service location on the map before booking");
      return;
    }
    try {
      setSubmitting(true);

      if (addressMode === "new") {
        const profile = await api<any>("/customer/profile").catch(() => ({}));
        const label = `${composedServiceAddress()}${city ? `, ${city}` : ""}`;
        await api("/customer/profile", {
          method: "PATCH",
          body: JSON.stringify({
            address_line1: doorNumber.trim() || profile.address_line1,
            address_line2: locationText.trim() || profile.address_line2,
            city: city.trim() || profile.city,
            district: profile.district,
            state: profile.state,
            pincode: profile.pincode,
            country: profile.country || "India",
            location_label: label,
            latitude: lat,
            longitude: lng,
          }),
        });
        await refreshServiceAvailability({ lat, lng });
      }

      const avail = await api<{ service_available: boolean }>(
        `/service-availability?lat=${lat}&lng=${lng}`
      );
      if (!avail.service_available) {
        toast.error(COMING_SOON_TITLE, { description: COMING_SOON_BODY });
        return;
      }

      // Resolve a pujari id only (no details shown to customer during booking).
      const nearby = await api<any[]>(
        `/pujaris/nearby?lat=${lat}&lng=${lng}&service_id=${serviceId}`,
      ).catch(() => [] as any[]);
      const pujariId = nearby[0]?.id || nearby[0]?.priestId;
      if (!pujariId) {
        toast.error(COMING_SOON_TITLE, { description: COMING_SOON_BODY });
        return;
      }
      const result = await api<{ id: string; booking_number: string; total_paise: number; meeting_url?: string }>("/bookings", {
        method: "POST",
        body: JSON.stringify({
          service_id: serviceId,
          pujari_id: pujariId,
          package_type: tier,
          mode: serviceMode === "virtual" ? "virtual" : "in_person",
          booking_date: format(bookingDate, "yyyy-MM-dd"),
          start_time: bookingTime.length === 5 ? `${bookingTime}:00` : bookingTime,
          location_label: `${composedServiceAddress()}${city ? `, ${city}` : ""}`,
          address: composedServiceAddress(),
          city,
          latitude: lat,
          longitude: lng,
          special_instructions: specialInstructions || undefined,
          terms_accepted: true,
          include_samagri: includeSamagri,
          include_alankaram: includeAlankaram,
          include_food: includeFood,
          recurring,
          recurring_count: recurring === "none" || recurring === "selected_dates" ? undefined : recurringCount,
          selected_dates:
            recurring === "selected_dates"
              ? selectedDates.map((d) => format(d, "yyyy-MM-dd"))
              : undefined,
        }),
      });
      toast.success("Booking confirmed and paid from wallet");
      setLocation(`/booking/${result.id || result.booking_number}`);
    } catch (error: any) {
      if (isServiceAreaUnavailableError(error?.message)) {
        toast.error(COMING_SOON_TITLE, { description: COMING_SOON_BODY });
      } else {
        toast.error(friendlyBookingError(error?.message) || "Failed to create booking");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium",
                  currentStep >= step.number ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
                )}
              >
                {currentStep > step.number ? <Check className="w-5 h-5" /> : step.number}
              </div>
              <span className="text-xs mt-1 text-gray-600">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={cn("w-12 sm:w-20 h-1 mx-2", currentStep > step.number ? "bg-primary" : "bg-gray-200")} />
            )}
          </div>
        ))}
      </div>

      {currentStep === 1 && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-foreground">{t("booking.package")}</h3>
          <RadioGroup value={tier} onValueChange={(v) => setTier(v as Tier)} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availableTiers.map((key) => (
              <Label
                key={key}
                htmlFor={key}
                className={cn(
                  "flex flex-col items-stretch w-full cursor-pointer rounded-lg p-4 transition-colors",
                  tier === key
                    ? "border-[3px] border-primary bg-primary/10 shadow-sm"
                    : "border border-border bg-background hover:border-muted-foreground/40"
                )}
              >
                <RadioGroupItem value={key} id={key} className="sr-only" />
                <div className="flex w-full items-start justify-between gap-3 mb-2">
                  <span className="font-semibold text-foreground">{tierDetails[key].name}</span>
                  <span className="text-lg font-bold text-primary shrink-0 whitespace-nowrap">
                    ₹{(Number(basePrices[key] || 0) / 100).toLocaleString("en-IN")}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3 w-full leading-relaxed">{tierDetails[key].description}</p>
                <ul className="text-xs text-muted-foreground space-y-1 w-full">
                  {tierDetails[key].features.map((f) => (
                    <li key={f} className="flex items-center gap-1">
                      <Check className="w-3 h-3 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
              </Label>
            ))}
          </RadioGroup>

          <div className="space-y-3">
            <Label>Puja Mode</Label>
            <RadioGroup
              value={serviceMode}
              onValueChange={(v) => setServiceMode(v as ServiceMode)}
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
            >
              <Label
                className={cn(
                  "flex flex-col items-start w-full cursor-pointer rounded-lg p-4 transition-colors",
                  serviceMode === "physical"
                    ? "border-[3px] border-primary bg-primary/10 shadow-sm"
                    : "border border-border bg-background hover:border-muted-foreground/40"
                )}
              >
                <RadioGroupItem value="physical" className="sr-only" />
                <span className="font-medium">{t("booking.physical")}</span>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">At customer location</p>
              </Label>
              {virtualEnabled && (
                <Label
                  className={cn(
                    "flex flex-col items-start w-full cursor-pointer rounded-lg p-4 transition-colors",
                    serviceMode === "virtual"
                      ? "border-[3px] border-primary bg-primary/10 shadow-sm"
                      : "border border-border bg-background hover:border-muted-foreground/40"
                  )}
                >
                  <RadioGroupItem value="virtual" className="sr-only" />
                  <span className="font-medium">{t("booking.virtual")}</span>
                  <p className="text-xs text-muted-foreground mt-1">Virtual / online session</p>
                </Label>
              )}
            </RadioGroup>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-foreground">{t("booking.details")}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("calendar.preference")}</Label>
              <Select value={calendarType} onValueChange={(v) => setCalendarType(v as CalendarType)}>
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
            <div className="space-y-2">
              <Label>Preferred Time</Label>
              <Input type="time" value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select Date *</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start", !bookingDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {bookingDate ? formatDisplayDate(bookingDate) : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={bookingDate}
                  onSelect={(date) => {
                    setBookingDate(date);
                    if (date) setDatePickerOpen(false);
                  }}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {panchang && (
              <Card className="border-orange-200 bg-primary/5">
                <CardContent className="p-4 text-sm space-y-1">
                  <p className="font-medium text-foreground">{t("calendar.panchangam")}</p>
                  <p>
                    <span className="font-medium">Tithi:</span> {panchang.tithi} ({panchang.paksha})
                  </p>
                  <p>
                    <span className="font-medium">Nakshatra:</span> {panchang.nakshatra}
                  </p>
                  <p>
                    <span className="font-medium">Lunar month:</span> {panchang.lunarMonth} — Day {panchang.lunarDay}
                  </p>
                  <p>
                    <span className="font-medium">Rahu Kalam:</span> {panchang.rahukaalam}
                  </p>
                  {panchang.isPeakDay && (
                    <Badge className="bg-red-100 text-red-700 mt-1">Peak Day — surge fee applies</Badge>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-3">
            <Label>Address *</Label>
            {savedAddressLoading ? (
              <p className="text-sm text-muted-foreground">Loading saved address…</p>
            ) : (
              <Select
                value={addressMode === "saved" && savedAddress ? "saved" : "new"}
                onValueChange={(v) => {
                  if (v === "saved") applySavedAddress();
                  else startNewAddress();
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select address" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Add new address</SelectItem>
                  {savedAddress ? (
                    <SelectItem value="saved">
                      {savedAddress.label.length > 80
                        ? `${savedAddress.label.slice(0, 80)}…`
                        : savedAddress.label}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            )}

            {addressMode === "saved" && savedAddress ? (
              <div className="rounded-md border border-border bg-muted/20 p-3 text-sm space-y-1">
                <p className="font-medium text-foreground">{savedAddress.label}</p>
                {savedAddress.city ? (
                  <p className="text-muted-foreground">City: {savedAddress.city}</p>
                ) : null}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin size={12} /> Service location for the assigned pujari
                  {lat != null && lng != null ? ` · GPS ${lat.toFixed(4)}, ${lng.toFixed(4)}` : ""}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">New address for this booking</p>
                <div className="space-y-2">
                  <Label htmlFor="booking-door">Door / flat / house no. *</Label>
                  <Input
                    id="booking-door"
                    value={doorNumber}
                    onChange={(e) => setDoorNumber(e.target.value)}
                    placeholder="e.g. Flat 302, Door 12-A"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="booking-street">Street / area *</Label>
                  <Textarea
                    id="booking-street"
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    placeholder="Street, colony, area"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="booking-landmark">Landmark (optional)</Label>
                  <Input
                    id="booking-landmark"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="Near temple / society gate"
                  />
                </div>
                <MapLocationPicker
                  value={
                    {
                      address_line1: doorNumber,
                      address_line2: locationText,
                      city,
                      district: "",
                      state: "",
                      pincode: "",
                      country: "India",
                      location_label: locationText || city || "",
                      latitude: lat,
                      longitude: lng,
                    } satisfies AddressValue
                  }
                  onChange={(v) => {
                    setLat(v.latitude);
                    setLng(v.longitude);
                    if (v.address_line1?.trim()) setDoorNumber(v.address_line1.trim());
                    const street =
                      (v.address_line2 || "").trim() ||
                      (v.location_label || "").trim();
                    if (street) setLocationText(street);
                    if (v.city?.trim()) setCity(v.city.trim());
                    setGeoError(null);
                  }}
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin size={12} /> Drag the pin or tap the map to set the exact location for the pujari
                  {lat != null && lng != null ? ` · GPS ${lat.toFixed(4)}, ${lng.toFixed(4)}` : ""}
                </p>
                {geoError && <p className="text-xs text-destructive">{geoError}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label>City *</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("booking.recurring")}</Label>
              <Select
                value={recurring}
                onValueChange={(v) => setRecurring(v as "none" | "weekly" | "monthly" | "selected_dates")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("booking.recurring.none")}</SelectItem>
                  <SelectItem value="weekly">{t("booking.recurring.weekly")}</SelectItem>
                  <SelectItem value="monthly">{t("booking.recurring.monthly")}</SelectItem>
                  <SelectItem value="selected_dates">{t("booking.recurring.selected")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {recurring !== "none" && recurring !== "selected_dates" && (
              <div className="space-y-2">
                <Label>{t("booking.recurring.count")}</Label>
                <Input
                  type="number"
                  min={2}
                  max={52}
                  value={recurringCount}
                  onChange={(e) => setRecurringCount(Number(e.target.value) || 2)}
                />
              </div>
            )}
          </div>
          {recurring === "selected_dates" && (
            <div className="space-y-2">
              <Label>{t("booking.recurring.addDates")}</Label>
              <div className="flex flex-wrap gap-2 items-end">
                <Popover open={extraDatePickerOpen} onOpenChange={setExtraDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {extraDate ? formatDisplayDate(extraDate) : t("booking.recurring.pickDate")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={extraDate}
                      onSelect={(date) => {
                        setExtraDate(date);
                        if (date) setExtraDatePickerOpen(false);
                      }}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!extraDate) return;
                    const key = format(extraDate, "yyyy-MM-dd");
                    if (selectedDates.some((d) => format(d, "yyyy-MM-dd") === key)) return;
                    setSelectedDates((prev) => [...prev, extraDate].sort((a, b) => a.getTime() - b.getTime()));
                    setExtraDate(undefined);
                  }}
                >
                  {t("common.add")}
                </Button>
              </div>
              <ul className="text-sm space-y-1">
                {selectedDates.map((d) => (
                  <li key={format(d, "yyyy-MM-dd")} className="flex justify-between gap-2">
                    <span>{formatDisplayDate(d)}</span>
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() =>
                        setSelectedDates((prev) => prev.filter((x) => format(x, "yyyy-MM-dd") !== format(d, "yyyy-MM-dd")))
                      }
                    >
                      {t("common.remove")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-2">
            <Label>Special Instructions</Label>
            <Textarea value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} />
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">{t("booking.review")}</h3>
          <Card>
            <CardContent className="p-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <div>
                  <p className="text-lg font-semibold">{pujaName}</p>
                  <Badge className="bg-primary mt-1">
                    {tierDetails[tier].name} ·{" "}
                    {serviceMode === "virtual" ? t("booking.virtual") : t("booking.physical")}
                  </Badge>
                </div>
              </div>
              <p>
                <span className="text-muted-foreground">Date: </span>
                {bookingDate ? formatDisplayDate(bookingDate) : "—"} {bookingTime}
              </p>
              <p>
                <span className="text-muted-foreground">Location: </span>
                {composedServiceAddress()}, {city}
              </p>
              <p className="text-xs text-muted-foreground">
                Pujari details will be shared closer to the puja (notification / Ongoing bookings).
              </p>
              <div className="bg-primary/5 border border-orange-200 rounded-md p-3 text-xs space-y-1">
                <p className="font-medium">{cancellationPolicy?.title || "Cancellation Policy"}</p>
                {(cancellationPolicy?.points || []).map((p, i) => (
                  <p key={i}>
                    {p.title ? <strong>{p.title}: </strong> : null}
                    {p.body}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>

          <AddonOptionsCard />

          <Card>
            <CardContent className="p-6 space-y-3 text-sm">
              <div className="border-t-0 space-y-1">
                <div className="flex justify-between">
                  <span>Service ({tierDetails[tier].name})</span>
                  <span>₹{(bill.basePrice / 100).toLocaleString("en-IN")}</span>
                </div>
                {Number(bill.samagri || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Samagri charge</span>
                    <span>₹{(bill.samagri / 100).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {Number(bill.alankaram || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Alankaram charge</span>
                    <span>₹{(bill.alankaram / 100).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {Number(bill.foodPrasadam || bill.food || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Food / Prasadam</span>
                    <span>₹{(Number(bill.foodPrasadam || bill.food) / 100).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {bill.peakFee > 0 && (
                  <div className="flex justify-between text-orange-700">
                    <span>{t("booking.peakFee")}</span>
                    <span>₹{(bill.peakFee / 100).toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{t("booking.subtotal")}</span>
                  <span>₹{(bill.subtotal / 100).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    {t("booking.gst")} ({bill.gstPercent}%)
                  </span>
                  <span>₹{(bill.gstAmount / 100).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>{t("booking.total")}</span>
                  <span className="text-primary">₹{(bill.totalAmount / 100).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">{t("booking.payment")}</h3>

          <Card>
            <CardContent className="p-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Service ({tierDetails[tier].name})</span>
                <span>₹{(bill.basePrice / 100).toLocaleString("en-IN")}</span>
              </div>
              {(includeSamagri || Number(bill.samagri || 0) > 0) && (
                <div className="flex justify-between">
                  <span>Samagri</span>
                  <span>
                    {Number(bill.samagri || samagriPrice || 0) > 0
                      ? `₹${(Number(bill.samagri || samagriPrice) / 100).toLocaleString("en-IN")}`
                      : "As priced"}
                  </span>
                </div>
              )}
              {(includeAlankaram || Number(bill.alankaram || 0) > 0) && (
                <div className="flex justify-between">
                  <span>Alankaram</span>
                  <span>
                    {Number(bill.alankaram || alankaramPrice || 0) > 0
                      ? `₹${(Number(bill.alankaram || alankaramPrice) / 100).toLocaleString("en-IN")}`
                      : "As priced"}
                  </span>
                </div>
              )}
              {(includeFood || Number(bill.foodPrasadam || bill.food || 0) > 0) && (
                <div className="flex justify-between">
                  <span>Food / Prasadam</span>
                  <span>
                    {Number(bill.foodPrasadam || bill.food || foodPrice || 0) > 0
                      ? `₹${(Number(bill.foodPrasadam || bill.food || foodPrice) / 100).toLocaleString("en-IN")}`
                      : "As priced"}
                  </span>
                </div>
              )}
              {bill.peakFee > 0 && (
                <div className="flex justify-between text-orange-700">
                  <span>{t("booking.peakFee")}</span>
                  <span>₹{(bill.peakFee / 100).toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>{t("booking.gst")} ({bill.gstPercent}%)</span>
                <span>₹{(bill.gstAmount / 100).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>{t("booking.total")}</span>
                <span className="text-primary">₹{(bill.totalAmount / 100).toLocaleString("en-IN")}</span>
              </div>
            </CardContent>
          </Card>

          {!isAuthenticated && !authLoading && (
            <Card className="border-orange-200 bg-primary/5">
              <CardContent className="p-6">
                <p className="mb-4 text-sm">Please login as a customer to pay from wallet and confirm booking.</p>
                <Button
                  onClick={() =>
                    setLocation(
                      getLoginUrl({
                        role: "customer",
                        returnPath: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/book",
                      })
                    )
                  }
                  className="bg-primary"
                >
                  <LogIn className="w-4 h-4 mr-2" /> Login
                </Button>
              </CardContent>
            </Card>
          )}
          {isAuthenticated && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span>{t("customer.balance")}</span>
                  <span className="font-semibold">
                    ₹{((wallet?.balance || 0) / 100).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>{t("booking.total")}</span>
                  <span className="text-primary">₹{(bill.totalAmount / 100).toLocaleString("en-IN")}</span>
                </div>
                <p className="text-xs text-muted-foreground">Paid from the same wallet as mobile (Supabase via FastAPI)</p>
                <div className="flex items-start gap-2 pt-2">
                  <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(!!v)} />
                  <label htmlFor="terms" className="text-sm leading-snug">
                    I agree to the{" "}
                    <button type="button" className="underline text-primary" onClick={() => setShowTerms(true)}>
                      Terms & Conditions and Cancellation Policy
                    </button>
                  </label>
                </div>
                {serviceMode === "virtual" && (
                  <p className="text-sm">
                    {t("booking.meetingLink")}: Google Meet invite is created for virtual bookings; join link unlocks in Ongoing within 24 hours
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setCurrentStep((s) => (s - 1) as BookingStep)} disabled={currentStep === 1}>
          <ChevronLeft className="w-4 h-4 mr-1" /> {t("common.back")}
        </Button>
        {currentStep < 4 ? (
          <Button
            className="bg-primary hover:bg-primary/90"
            disabled={!canProceed()}
            onClick={() => setCurrentStep((s) => (s + 1) as BookingStep)}
          >
            {t("common.next")} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          isAuthenticated && (
            <Button
              className="bg-primary hover:bg-primary/90"
              disabled={submitting || !termsAccepted}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Processing...
                </>
              ) : (
                t("booking.payWallet")
              )}
            </Button>
          )
        )}
      </div>
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Terms & Conditions and Cancellation Policy</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-6">
            {[bookingTerms, cancellationPolicy].filter(Boolean).map((policy) => (
              <div key={policy!.slug} className="space-y-3">
                <h3 className="font-semibold text-foreground">{policy!.title}</h3>
                {policy!.points.map((p, i) => (
                  <div key={i}>
                    {p.title ? <p className="font-medium text-foreground">{p.title}</p> : null}
                    <p>{p.body}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
