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
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
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

interface BookingWizardProps {
  serviceId: string;
  pujaName: string;
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

const DEMO_LAT = 12.9352;
const DEMO_LNG = 77.6245;

function pickAddressComponent(
  components: { long_name: string; types: string[] }[] | undefined,
  type: string,
) {
  return components?.find((c) => c.types.includes(type))?.long_name || "";
}

async function reverseGeocodeCoords(
  latitude: number,
  longitude: number,
): Promise<{ address: string; city: string }> {
  // Prefer Google Geocoder when Maps is already loaded (e.g. address page)
  const g = typeof window !== "undefined" ? (window as any).google : null;
  if (g?.maps?.Geocoder) {
    const result = await new Promise<any | null>((resolve) => {
      const geocoder = new g.maps.Geocoder();
      geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results: any[], status: string) => {
        resolve(status === "OK" && results?.[0] ? results[0] : null);
      });
    });
    if (result) {
      const city =
        pickAddressComponent(result.address_components, "locality") ||
        pickAddressComponent(result.address_components, "administrative_area_level_2") ||
        pickAddressComponent(result.address_components, "administrative_area_level_3");
      return {
        address: result.formatted_address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        city,
      };
    }
  }

  // Fallback: OpenStreetMap Nominatim (works without Maps API key)
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
    String(latitude),
  )}&lon=${encodeURIComponent(String(longitude))}&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Could not resolve address for this location");
  const data = (await res.json()) as {
    display_name?: string;
    address?: {
      city?: string;
      town?: string;
      village?: string;
      suburb?: string;
      county?: string;
      state_district?: string;
      road?: string;
      neighbourhood?: string;
      house_number?: string;
    };
  };
  const a = data.address || {};
  const city = a.city || a.town || a.village || a.suburb || a.county || a.state_district || "";
  const street = [a.house_number, a.road, a.neighbourhood].filter(Boolean).join(" ");
  const address = data.display_name || street || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  return { address, city };
}

export default function BookingWizard({ serviceId, pujaName, basePrices, addonPrices }: BookingWizardProps) {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
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
  const [city, setCity] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoPending, setGeoPending] = useState(false);
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
              <p className="font-semibold text-foreground">Samagri &amp; Alankaram (optional)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tick if you want these arranged for your puja. The charge is added to your booking payment now;
                BSeva pays the pujari later. Leave unchecked if you will arrange yourself.
              </p>
            </div>
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
                <div className="flex justify-between gap-2">
                  <span className="font-medium">Samagri kit</span>
                  <span className="font-semibold text-primary shrink-0">
                    {samagriPrice > 0
                      ? `₹${(samagriPrice / 100).toLocaleString("en-IN")}`
                      : "Charge on booking"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Puja materials arranged for you — charged in your booking total.
                </p>
                {includeSamagri && (
                  <p className="text-xs font-semibold text-primary mt-1">
                    Selected — added to your payment (paid to pujari later by BSeva).
                  </p>
                )}
              </div>
            </label>
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
                <div className="flex justify-between gap-2">
                  <span className="font-medium">Alankaram</span>
                  <span className="font-semibold text-primary shrink-0">
                    {alankaramPrice > 0
                      ? `₹${(alankaramPrice / 100).toLocaleString("en-IN")}`
                      : "Charge on booking"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Flowers / decoration arranged for you — charged in your booking total.
                </p>
                {includeAlankaram && (
                  <p className="text-xs font-semibold text-primary mt-1">
                    Selected — added to your payment (paid to pujari later by BSeva).
                  </p>
                )}
              </div>
            </label>
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
                      {foodPrice > 0
                        ? `₹${(foodPrice / 100).toLocaleString("en-IN")}`
                        : "Charge on booking"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Prasadam / food arrangement for this puja (when offered) — charged in your booking total.
                  </p>
                  {includeFood && (
                    <p className="text-xs font-semibold text-primary mt-1">
                      Selected — added to your payment (paid to pujari later by BSeva).
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
                {addonConfirm === "alankaram"
                  ? "Add Alankaram charge"
                  : addonConfirm === "food"
                    ? "Add Food / Prasadam charge"
                    : "Add Samagri charge"}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2 text-left">
                <span className="block">
                  If you continue,{" "}
                  <strong>
                    {addonConfirm === "alankaram"
                      ? "Alankaram (flowers / decoration)"
                      : addonConfirm === "food"
                        ? "Food / Prasadam"
                        : "Samagri (puja materials)"}
                  </strong>{" "}
                  will be arranged and the charge will be added to your booking payment.
                </span>
                <span className="block">
                  You pay BSeva now. We settle this amount with the pujari later from our backend.
                </span>
                <span className="block">Click OK to confirm, or Cancel to arrange it yourself.</span>
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
    if (currentStep === 2) return !!(bookingDate && locationText && city);
    return true;
  };

  const handleSubmit = async () => {
    if (!bookingDate) {
      toast.error("Please select a booking date");
      return;
    }
    try {
      setSubmitting(true);
      // Resolve a pujari id only (no details shown to customer during booking).
      const nearby = await api<any[]>(
        `/pujaris/nearby?lat=${lat ?? DEMO_LAT}&lng=${lng ?? DEMO_LNG}&service_id=${serviceId}`,
      ).catch(() => [] as any[]);
      const list = nearby.length ? nearby : await api<any[]>("/pujaris").catch(() => [] as any[]);
      const pujariId = list[0]?.id || list[0]?.priestId;
      if (!pujariId) {
        toast.error("No available pujari for this service");
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
          location_label: `${locationText}${city ? `, ${city}` : ""}`,
          address: locationText,
          city,
          latitude: lat ?? DEMO_LAT,
          longitude: lng ?? DEMO_LNG,
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
      toast.error(error?.message || "Failed to create booking");
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
                  {bookingDate ? format(bookingDate, "PPP") : "Select date"}
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

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Address *</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={geoPending}
                onClick={() => {
                  if (!navigator.geolocation) {
                    setGeoError("Geolocation is not supported in this browser. Enter address manually.");
                    return;
                  }
                  setGeoPending(true);
                  setGeoError(null);
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const latitude = pos.coords.latitude;
                      const longitude = pos.coords.longitude;
                      setLat(latitude);
                      setLng(longitude);
                      void (async () => {
                        try {
                          const resolved = await reverseGeocodeCoords(latitude, longitude);
                          setLocationText(resolved.address);
                          if (resolved.city) setCity(resolved.city);
                          toast.success("Address and city updated from your location");
                        } catch {
                          setLocationText(`Current location (GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
                          toast.message("GPS saved — enter address and city manually if needed");
                        } finally {
                          setGeoPending(false);
                        }
                      })();
                    },
                    (err) => {
                      setGeoPending(false);
                      setGeoError(
                        err.code === err.PERMISSION_DENIED
                          ? "Location permission denied. Enter the address manually."
                          : "Could not get location. Enter the address manually."
                      );
                    },
                    { enableHighAccuracy: true, timeout: 12000 }
                  );
                }}
              >
                {geoPending ? "Locating…" : "Use my location"}
              </Button>
            </div>
            <Textarea
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder="House/flat, street, landmark"
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin size={12} /> Service location for the assigned pujari
              {lat != null && lng != null ? ` · GPS ${lat.toFixed(4)}, ${lng.toFixed(4)}` : ""}
            </p>
            {geoError && <p className="text-xs text-destructive">{geoError}</p>}
          </div>
          <div className="space-y-2">
            <Label>City *</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
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
                      {extraDate ? format(extraDate, "PPP") : t("booking.recurring.pickDate")}
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
                    <span>{format(d, "PPP")}</span>
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
                {bookingDate ? format(bookingDate, "PPP") : "—"} {bookingTime}
              </p>
              <p>
                <span className="text-muted-foreground">Location: </span>
                {locationText}, {city}
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
                    {t("booking.meetingLink")}: will appear after confirmation
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
