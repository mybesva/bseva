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
import {
  bookingLeadHint,
  earliestBookingInstant,
  isCalendarDayDisabled,
} from "@/lib/bookingLeadTime";
import {
  pujarisForPackage,
  pujarisIncludedShort,
  type PackageTier,
  type ServicePujariConfig,
} from "@/lib/pujariTeam";

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
  /** Minimum hours before puja start (from service; default 48 = 2 days). */
  bookingLeadHours?: number;
  /** Per-package pujari team size (from admin catalog). */
  pujariTeam?: ServicePujariConfig | null;
  /** When in-person service is unavailable in the customer's area, allow Virtual Puja only. */
  forceVirtualOnly?: boolean;
  /** Per-service catalog flag. */
  serviceVirtualAvailable?: boolean;
}

const VIRTUAL_COUNTRIES: { id: string; label: string }[] = [
  { id: "IN", label: "India" },
  { id: "AE", label: "United Arab Emirates" },
  { id: "US", label: "United States" },
  { id: "GB", label: "United Kingdom" },
  { id: "SG", label: "Singapore" },
  { id: "MY", label: "Malaysia" },
  { id: "AU", label: "Australia" },
  { id: "CA", label: "Canada" },
  { id: "NZ", label: "New Zealand" },
  { id: "DE", label: "Germany" },
  { id: "FR", label: "France" },
  { id: "NL", label: "Netherlands" },
  { id: "IE", label: "Ireland" },
  { id: "JP", label: "Japan" },
  { id: "TH", label: "Thailand" },
  { id: "SA", label: "Saudi Arabia" },
  { id: "QA", label: "Qatar" },
  { id: "KW", label: "Kuwait" },
  { id: "OM", label: "Oman" },
  { id: "BH", label: "Bahrain" },
  { id: "ZA", label: "South Africa" },
];

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

type BookingStep = 1 | 2 | 3 | 4;
type Tier = "basic" | "standard" | "premium";
type ServiceMode = "physical" | "virtual";
type CalendarType = "north" | "south" | "lunar";

type Step2FieldErrors = Partial<
  Record<
    | "bookingDate"
    | "address"
    | "doorNumber"
    | "locationText"
    | "mapLocation"
    | "city"
    | "customerTimezone"
    | "customerCountry",
    string
  >
>;

function RequiredMark() {
  return (
    <span className="text-destructive font-semibold ml-0.5" aria-hidden="true">
      *
    </span>
  );
}

function fieldHasError(errors: Step2FieldErrors, key: keyof Step2FieldErrors) {
  return Boolean(errors[key]);
}

function addonListPaise(
  selected: boolean,
  quoteCharge: number | undefined,
  listFromService: number | undefined,
  listFromQuote: number | undefined,
): number {
  const list = Math.max(0, Number(listFromService ?? listFromQuote ?? 0));
  if (!selected) return 0;
  const fromQuote = Math.max(0, Number(quoteCharge ?? 0));
  return fromQuote > 0 ? fromQuote : list;
}

function buildBookingBill(input: {
  quote: any | null;
  tier: Tier;
  basePrices: BookingWizardProps["basePrices"];
  settings: Record<string, string> | null;
  includeSamagri: boolean;
  includeAlankaram: boolean;
  includeFood: boolean;
  addonPrices?: BookingWizardProps["addonPrices"];
}) {
  const { quote, tier, basePrices, settings, includeSamagri, includeAlankaram, includeFood, addonPrices } =
    input;
  const gstPercent = Number(quote?.gstPercent ?? settings?.gstPercent ?? 18);
  const basePrice = quote
    ? Number(quote.basePrice ?? quote.mainPuja ?? 0)
    : Number(basePrices[tier] || basePrices.standard || 0);
  const locAdj = quote ? Number(quote.locationAdjustment ?? 0) : 0;
  const peakFee = quote ? Number(quote.peakFee ?? 0) : 0;
  const samagri = addonListPaise(
    includeSamagri,
    quote?.samagri,
    addonPrices?.samagri ?? undefined,
    quote?.samagriListPrice,
  );
  const alankaram = addonListPaise(
    includeAlankaram,
    quote?.alankaram,
    addonPrices?.alankaram ?? undefined,
    quote?.alankaramListPrice,
  );
  const foodOn = Boolean(addonPrices?.foodAvailable);
  const food = addonListPaise(
    includeFood && foodOn,
    quote?.foodPrasadam ?? quote?.food,
    addonPrices?.food ?? undefined,
    quote?.foodListPrice,
  );
  const discount = quote ? Number(quote.discount ?? 0) : 0;
  const walletCredit = quote ? Number(quote.walletCredit ?? 0) : 0;
  const adjustedBase = basePrice + locAdj;
  const subtotal = Math.max(0, adjustedBase + peakFee + samagri + alankaram + food - discount - walletCredit);
  const gstAmount = Math.round((subtotal * gstPercent) / 100);
  const totalAmount = subtotal + gstAmount;
  return {
    basePrice,
    locationAdjustment: locAdj,
    samagri,
    alankaram,
    foodPrasadam: food,
    food,
    peakFee,
    subtotal,
    gstPercent,
    gstAmount,
    totalAmount,
    isPeakDay: Boolean(quote?.peakReason || peakFee > 0),
  };
}

export default function BookingWizard({
  serviceId,
  pujaName,
  serviceCategories,
  basePrices,
  addonPrices,
  bookingLeadHours = 48,
  pujariTeam,
  forceVirtualOnly = false,
  serviceVirtualAvailable = true,
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
  const [step2Errors, setStep2Errors] = useState<Step2FieldErrors>({});
  const [customerTimezone, setCustomerTimezone] = useState(browserTimezone);
  const [customerCountry, setCustomerCountry] = useState("IN");
  const [vpnBlocked, setVpnBlocked] = useState(false);
  const [vpnMessage, setVpnMessage] = useState("");
  const { config: publicConfig } = usePublicConfig();
  const settings = {
    virtualPujaEnabled: publicConfig.virtual_puja_enabled ? "true" : "false",
    gstPercent: "18",
  };

  useEffect(() => {
    if (bookingDate && isCalendarDayDisabled(bookingDate, bookingLeadHours)) {
      setBookingDate(undefined);
    }
  }, [bookingLeadHours, bookingDate]);

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
    const qs = new URLSearchParams({
      service_id: serviceId,
      package_type: tier,
      city: city || "",
      include_samagri: includeSamagri ? "true" : "false",
      include_alankaram: includeAlankaram ? "true" : "false",
      include_food: includeFood ? "true" : "false",
    });
    if (bookingDate) qs.set("booking_date", format(bookingDate, "yyyy-MM-dd"));
    qs.set("mode", serviceMode === "virtual" ? "virtual" : "in_person");
    if (customerCountry) qs.set("country", customerCountry);
    api(`/quote?${qs}`)
      .then(setQuote)
      .catch(() => setQuote(null));
  }, [
    bookingDate,
    serviceId,
    tier,
    city,
    includeSamagri,
    includeAlankaram,
    includeFood,
    serviceMode,
    customerCountry,
  ]);

  const samagriListPaise = Number(addonPrices?.samagri ?? quote?.samagriListPrice ?? 0);
  const samagriPrice = samagriListPaise;
  const alankaramPrice = Number(addonPrices?.alankaram || quote?.alankaramListPrice || 0);
  const foodPrice = Number(addonPrices?.food || quote?.foodListPrice || 0);
  const foodAvailable = Boolean(addonPrices?.foodAvailable);
  const deathRelated = isDeathRelatedService(serviceCategories);
  // Samagri: on by default for every puja unless admin turns it off. Alankaram: admin-only.
  const showSamagri = addonPrices?.samagriAvailable !== false;
  const alankaramOffered =
    !deathRelated && Boolean(addonPrices?.alankaramAvailable) && alankaramPrice > 0;
  const showAlankaramComingSoon = !deathRelated && !alankaramOffered;

  function formatInr(paise: number): string {
    return `₹${(paise / 100).toLocaleString("en-IN")}`;
  }

  function formatPlusPrice(paise: number): string {
    if (paise <= 0) return "—";
    return `+ ${formatInr(paise)}`;
  }

  function BookingTotalsSummary() {
    const samagriAmt = includeSamagri ? Number(bill.samagri || 0) : 0;
    const alankaramAmt = includeAlankaram ? Number(bill.alankaram || 0) : 0;
    const foodAmt = includeFood ? Number(bill.foodPrasadam || bill.food || 0) : 0;
    return (
      <div className="space-y-2 text-sm">
        <p className="text-xs text-muted-foreground pb-2 border-b border-border/60">
          {pujarisIncludedShort(selectedPujariCount)}
        </p>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Service ({tierDetails[tier].name})</span>
          <span className="font-medium tabular-nums">{formatInr(bill.basePrice)}</span>
        </div>
        {includeSamagri && samagriAmt > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Samagri Kit</span>
            <span className="font-medium tabular-nums">{formatInr(samagriAmt)}</span>
          </div>
        )}
        {includeAlankaram && alankaramAmt > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Alankaram</span>
            <span className="font-medium tabular-nums">{formatInr(alankaramAmt)}</span>
          </div>
        )}
        {includeFood && foodAmt > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Food / Prasadam</span>
            <span className="font-medium tabular-nums">{formatInr(foodAmt)}</span>
          </div>
        )}
        {bill.peakFee > 0 && (
          <div className="flex justify-between gap-4 text-orange-700">
            <span>{t("booking.peakFee")}</span>
            <span className="font-medium tabular-nums">{formatInr(bill.peakFee)}</span>
          </div>
        )}
        <div className="flex justify-between gap-4 pt-1 border-t border-border">
          <span className="text-muted-foreground">{t("booking.subtotal")}</span>
          <span className="font-medium tabular-nums">{formatInr(bill.subtotal)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">
            {t("booking.gst")} ({bill.gstPercent}%)
          </span>
          <span className="font-medium tabular-nums">{formatInr(bill.gstAmount)}</span>
        </div>
        <div className="flex justify-between gap-4 font-semibold text-base border-t border-border pt-2">
          <span>{t("booking.total")}</span>
          <span className="text-primary tabular-nums">{formatInr(bill.totalAmount)}</span>
        </div>
      </div>
    );
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
        <Card className="border border-border/80 bg-card shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div>
              <p className="font-semibold text-foreground tracking-tight">
                {alankaramOffered || showAlankaramComingSoon
                  ? "Samagri & Alankaram (Optional)"
                  : "Samagri (Optional)"}
              </p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Add optional arrangements to your puja booking. Selected items will be included in your booking
                total.
              </p>
            </div>
            {showSamagri && (
            <label
              className={cn(
                "flex items-start gap-3 rounded-lg p-3.5 cursor-pointer transition-colors",
                includeSamagri
                  ? "border-[3px] border-primary bg-primary/10 shadow-sm"
                  : "border border-border bg-background hover:border-muted-foreground/40"
              )}
            >
              <Checkbox
                checked={includeSamagri}
                onCheckedChange={(v) => requestAddon("samagri", !!v)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0 flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">Samagri Kit</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Puja materials arranged for you</p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      includeSamagri ? "text-primary" : "text-foreground"
                    )}
                  >
                    {samagriListPaise > 0 ? formatPlusPrice(samagriListPaise) : "—"}
                  </p>
                  {includeSamagri && samagriListPaise > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">Included in total booking</p>
                  )}
                </div>
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
                    <span className="text-sm font-semibold shrink-0 tabular-nums">
                      {formatPlusPrice(alankaramPrice)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Flowers and decoration arranged for your puja
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 shrink-0">
                      COMING SOON
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Flowers and decoration services will be available soon.
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
                    <span className="font-semibold text-primary shrink-0 tabular-nums">
                      {formatPlusPrice(foodPrice)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Prasadam / food arrangement for this puja (when offered)
                  </p>
                  {includeFood && foodPrice > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1 text-right">Included in total booking</p>
                  )}
                </div>
              </label>
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
                  {(addonConfirm === "food" ? foodPrice : samagriListPaise) > 0
                    ? `${formatPlusPrice(addonConfirm === "food" ? foodPrice : samagriListPaise)} included in total booking.`
                    : "Included in total booking."}
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

  /** Book Standard and Premium only (no Basic tier in customer flow). */
  const availableTiers = (["standard", "premium"] as Tier[]).filter(
    (key) => Number(basePrices[key] || 0) > 0
  );

  const tierPujariCount = (key: Tier) => pujarisForPackage(pujariTeam, key as PackageTier);
  const selectedPujariCount = tierPujariCount(tier);

  useEffect(() => {
    if (availableTiers.length && !availableTiers.includes(tier)) {
      setTier(availableTiers.includes("standard") ? "standard" : availableTiers[0]);
    }
  }, [availableTiers.join(","), tier]);

  const steps = [
    { number: 1, title: t("booking.package") },
    { number: 2, title: t("booking.details") },
    { number: 3, title: t("booking.review") },
    { number: 4, title: t("booking.payment") },
  ];

  const virtualEnabled =
    settings?.virtualPujaEnabled !== "false" && serviceVirtualAvailable !== false;

  useEffect(() => {
    if (!virtualEnabled && serviceMode === "virtual") {
      setServiceMode("physical");
    }
  }, [virtualEnabled, serviceMode]);

  useEffect(() => {
    if (forceVirtualOnly && virtualEnabled) {
      setServiceMode("virtual");
    }
  }, [forceVirtualOnly, virtualEnabled]);

  useEffect(() => {
    if (serviceMode !== "virtual") {
      setVpnBlocked(false);
      setVpnMessage("");
      return;
    }
    let cancelled = false;
    api<{ ok: boolean; blocked?: boolean; message?: string; country_code?: string }>(
      "/bookings/virtual-precheck",
      { method: "POST", body: "{}" },
    )
      .then((r) => {
        if (cancelled) return;
        if (r.blocked) {
          setVpnBlocked(true);
          setVpnMessage(
            r.message ||
              "Virtual Puja cannot be booked while a VPN or proxy is active. Please turn off your VPN/proxy and try again.",
          );
        } else {
          setVpnBlocked(false);
          setVpnMessage("");
          if (r.country_code) {
            const code = String(r.country_code).toUpperCase();
            setCustomerCountry((prev) =>
              VIRTUAL_COUNTRIES.some((c) => c.id === code) ? code : prev,
            );
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVpnBlocked(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [serviceMode]);

  const bill = useMemo(
    () =>
      buildBookingBill({
        quote,
        tier,
        basePrices,
        settings,
        includeSamagri,
        includeAlankaram,
        includeFood,
        addonPrices,
      }),
    [quote, basePrices, tier, settings, includeSamagri, includeAlankaram, includeFood, addonPrices],
  );

  function selectedBookingStart(): Date | null {
    if (!bookingDate) return null;
    const d = new Date(bookingDate);
    const t = (bookingTime || "").trim();
    const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      d.setHours(Number(m[1]), Number(m[2]), Number(m[3] || 0), 0);
    } else {
      d.setHours(23, 59, 59, 999);
    }
    return d;
  }

  function validateStep2(): boolean {
    const err: Step2FieldErrors = {};
    if (!bookingDate) err.bookingDate = "Select a booking date";
    else if (isCalendarDayDisabled(bookingDate, bookingLeadHours)) {
      err.bookingDate = bookingLeadHint(bookingLeadHours);
    } else {
      const start = selectedBookingStart();
      if (start && start < earliestBookingInstant(bookingLeadHours)) {
        err.bookingDate = bookingLeadHint(bookingLeadHours);
      }
    }
    if (serviceMode === "virtual") {
      if (!customerTimezone.trim()) err.customerTimezone = "Select your timezone";
      if (!customerCountry.trim()) err.customerCountry = "Select your country";
    } else {
      if (!city.trim()) err.city = "Enter city";
      if (addressMode === "saved") {
        const addr = composedServiceAddress();
        if (!savedAddress || !addr.trim()) err.address = "Choose a saved address or add a new one";
        if (lat == null || lng == null) err.mapLocation = "Address must include map location";
      } else {
        if (!doorNumber.trim()) err.doorNumber = "Enter door / flat / house number";
        if (!locationText.trim()) err.locationText = "Enter street / area";
        if (lat == null || lng == null) err.mapLocation = "Set the pin on the map";
      }
    }
    setStep2Errors(err);
    if (Object.keys(err).length > 0) {
      toast.error("Please complete all required fields highlighted below.");
      return false;
    }
    return true;
  }

  function handleNextStep() {
    if (currentStep === 1) {
      if (!tier || !serviceMode) {
        toast.error("Please select a package and puja mode.");
        return;
      }
      if (serviceMode === "virtual" && vpnBlocked) {
        toast.error(vpnMessage || "Please turn off your VPN/proxy to continue with Virtual Puja.");
        return;
      }
    }
    if (currentStep === 2 && !validateStep2()) return;
    setStep2Errors({});
    setCurrentStep((s) => (s + 1) as BookingStep);
  }

  const inputErrorClass = "border-destructive ring-1 ring-destructive/30 focus-visible:ring-destructive";

  const handleSubmit = async () => {
    if (!bookingDate) {
      toast.error("Please select a booking date");
      return;
    }
    const isVirtual = serviceMode === "virtual";
    if (isVirtual && vpnBlocked) {
      toast.error(vpnMessage || "Please turn off your VPN/proxy to continue with Virtual Puja.");
      return;
    }
    if (!isVirtual && (lat == null || lng == null)) {
      toast.error("Please set the service location on the map before booking");
      return;
    }
    try {
      setSubmitting(true);

      if (isVirtual) {
        const pre = await api<{ ok: boolean; blocked?: boolean; message?: string }>(
          "/bookings/virtual-precheck",
          { method: "POST", body: "{}" },
        );
        if (pre.blocked) {
          setVpnBlocked(true);
          setVpnMessage(pre.message || "");
          toast.error(
            pre.message ||
              "Virtual Puja cannot be booked while a VPN or proxy is active. Please turn off your VPN/proxy and try again.",
          );
          return;
        }
      }

      if (!isVirtual && addressMode === "new") {
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

      if (!isVirtual) {
        const avail = await api<{ service_available: boolean }>(
          `/service-availability?lat=${lat}&lng=${lng}`
        );
        if (!avail.service_available) {
          toast.error(COMING_SOON_TITLE, { description: COMING_SOON_BODY });
          return;
        }
      }

      const countryLabel = VIRTUAL_COUNTRIES.find((c) => c.id === customerCountry)?.label || customerCountry;
      const virtualLocation = `Virtual Puja · ${countryLabel} · ${customerTimezone}`;

      // Pujari is assigned by admin after payment (service area already verified above).
      const result = await api<{
        id: string;
        booking_number: string;
        total_paise: number;
        meeting_url?: string;
        awaiting_pujari_assignment?: boolean;
      }>("/bookings", {
        method: "POST",
        body: JSON.stringify({
          service_id: serviceId,
          package_type: tier,
          mode: isVirtual ? "virtual" : "in_person",
          booking_date: format(bookingDate, "yyyy-MM-dd"),
          start_time: bookingTime.length === 5 ? `${bookingTime}:00` : bookingTime,
          location_label: isVirtual
            ? virtualLocation
            : `${composedServiceAddress()}${city ? `, ${city}` : ""}`,
          address: isVirtual ? virtualLocation : composedServiceAddress(),
          city: isVirtual ? countryLabel : city,
          latitude: isVirtual ? undefined : lat,
          longitude: isVirtual ? undefined : lng,
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
          customer_timezone: isVirtual ? customerTimezone : undefined,
          customer_country: isVirtual ? customerCountry : undefined,
        }),
      });
      toast.success(
        result.awaiting_pujari_assignment
          ? Number((result as { offers_sent?: number }).offers_sent || 0) > 0
            ? "Booking confirmed — nearby pujaris have been notified to accept."
            : "Booking confirmed — our team will assign a pujari shortly."
          : "Booking confirmed and paid from wallet",
      );
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
          <RadioGroup value={tier} onValueChange={(v) => setTier(v as Tier)} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
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
                <p className="text-sm text-muted-foreground mb-2 w-full leading-relaxed">{tierDetails[key].description}</p>
                <p className="text-sm font-medium text-foreground mb-3 w-full">
                  {pujarisIncludedShort(tierPujariCount(key))}
                </p>
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
              {!forceVirtualOnly && (
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
              )}
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
            {serviceMode === "virtual" && vpnBlocked && (
              <p className="text-sm text-destructive">{vpnMessage}</p>
            )}
            {forceVirtualOnly && virtualEnabled && (
              <p className="text-xs text-muted-foreground">
                In-person booking is not available at your location. You can continue with Virtual Puja.
              </p>
            )}
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
            <Label>
              Select Date
              <RequiredMark />
            </Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start",
                    !bookingDate && "text-muted-foreground",
                    fieldHasError(step2Errors, "bookingDate") && inputErrorClass,
                  )}
                >
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
                    if (date) {
                      setDatePickerOpen(false);
                      setStep2Errors((e) => ({ ...e, bookingDate: undefined }));
                    }
                  }}
                  disabled={(date) => isCalendarDayDisabled(date, bookingLeadHours)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">{bookingLeadHint(bookingLeadHours)}</p>
            {step2Errors.bookingDate && (
              <p className="text-xs text-destructive">{step2Errors.bookingDate}</p>
            )}
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
                  {Number(quote?.peakFee || 0) > 0 && (
                    <Badge className="bg-orange-100 text-orange-800 mt-1">Weekend / festival surge applies</Badge>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {serviceMode === "virtual" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Your country
                  <RequiredMark />
                </Label>
                <Select
                  value={customerCountry}
                  onValueChange={(v) => {
                    setCustomerCountry(v);
                    setStep2Errors((e) => ({ ...e, customerCountry: undefined }));
                  }}
                >
                  <SelectTrigger className={cn(fieldHasError(step2Errors, "customerCountry") && inputErrorClass)}>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {VIRTUAL_COUNTRIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {step2Errors.customerCountry && (
                  <p className="text-xs text-destructive">{step2Errors.customerCountry}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>
                  Your timezone
                  <RequiredMark />
                </Label>
                <Select
                  value={customerTimezone}
                  onValueChange={(v) => {
                    setCustomerTimezone(v);
                    setStep2Errors((e) => ({ ...e, customerTimezone: undefined }));
                  }}
                >
                  <SelectTrigger className={cn(fieldHasError(step2Errors, "customerTimezone") && inputErrorClass)}>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {(publicConfig.customer_timezones?.length
                      ? publicConfig.customer_timezones
                      : [{ id: "Asia/Kolkata", label: "India (IST)" }]
                    )
                      .concat(
                        customerTimezone &&
                          !(publicConfig.customer_timezones || []).some((z) => z.id === customerTimezone)
                          ? [{ id: customerTimezone, label: customerTimezone }]
                          : [],
                      )
                      .map((z) => (
                        <SelectItem key={z.id} value={z.id}>
                          {z.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {step2Errors.customerTimezone && (
                  <p className="text-xs text-destructive">{step2Errors.customerTimezone}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Choose the date and time in your local timezone. Pujari availability is checked in India time (IST).
                </p>
              </div>
            </div>
          )}

          {serviceMode !== "virtual" && (
          <div className="space-y-3">
            <Label>
              Address
              <RequiredMark />
            </Label>
            {savedAddressLoading ? (
              <p className="text-sm text-muted-foreground">Loading saved address…</p>
            ) : (
              <Select
                value={addressMode === "saved" && savedAddress ? "saved" : "new"}
                onValueChange={(v) => {
                  if (v === "saved") applySavedAddress();
                  else startNewAddress();
                  setStep2Errors((e) => ({ ...e, address: undefined, mapLocation: undefined }));
                }}
              >
                <SelectTrigger
                  className={cn(fieldHasError(step2Errors, "address") && inputErrorClass)}
                >
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
            {step2Errors.address && <p className="text-xs text-destructive">{step2Errors.address}</p>}

            {addressMode === "saved" && savedAddress ? (
              <div
                className={cn(
                  "rounded-md border border-border bg-muted/20 p-3 text-sm space-y-1",
                  fieldHasError(step2Errors, "mapLocation") && "border-destructive ring-1 ring-destructive/30",
                )}
              >
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
                  <Label htmlFor="booking-door">
                    Door / flat / house no.
                    <RequiredMark />
                  </Label>
                  <Input
                    id="booking-door"
                    value={doorNumber}
                    onChange={(e) => {
                      setDoorNumber(e.target.value);
                      if (e.target.value.trim()) setStep2Errors((er) => ({ ...er, doorNumber: undefined }));
                    }}
                    placeholder="e.g. Flat 302, Door 12-A"
                    aria-invalid={fieldHasError(step2Errors, "doorNumber")}
                    className={cn(fieldHasError(step2Errors, "doorNumber") && inputErrorClass)}
                  />
                  {step2Errors.doorNumber && (
                    <p className="text-xs text-destructive">{step2Errors.doorNumber}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="booking-street">
                    Street / area
                    <RequiredMark />
                  </Label>
                  <Textarea
                    id="booking-street"
                    value={locationText}
                    onChange={(e) => {
                      setLocationText(e.target.value);
                      if (e.target.value.trim()) setStep2Errors((er) => ({ ...er, locationText: undefined }));
                    }}
                    placeholder="Street, colony, area"
                    rows={3}
                    aria-invalid={fieldHasError(step2Errors, "locationText")}
                    className={cn(fieldHasError(step2Errors, "locationText") && inputErrorClass)}
                  />
                  {step2Errors.locationText && (
                    <p className="text-xs text-destructive">{step2Errors.locationText}</p>
                  )}
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
                <div
                  className={cn(
                    fieldHasError(step2Errors, "mapLocation") &&
                      "rounded-lg ring-1 ring-destructive/40 p-0.5",
                  )}
                >
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
                    if (v.latitude != null && v.longitude != null) {
                      setStep2Errors((er) => ({ ...er, mapLocation: undefined }));
                    }
                  }}
                />
                </div>
                {step2Errors.mapLocation && (
                  <p className="text-xs text-destructive">{step2Errors.mapLocation}</p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin size={12} /> Drag the pin or tap the map to set the exact location for the pujari
                  {lat != null && lng != null ? ` · GPS ${lat.toFixed(4)}, ${lng.toFixed(4)}` : ""}
                </p>
                {geoError && <p className="text-xs text-destructive">{geoError}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label>
                City
                <RequiredMark />
              </Label>
              <Input
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  if (e.target.value.trim()) setStep2Errors((er) => ({ ...er, city: undefined }));
                }}
                placeholder="City"
                aria-invalid={fieldHasError(step2Errors, "city")}
                className={cn(fieldHasError(step2Errors, "city") && inputErrorClass)}
              />
              {step2Errors.city && <p className="text-xs text-destructive">{step2Errors.city}</p>}
            </div>
          </div>
          )}
          {serviceMode === "virtual" && (
            <p className="text-sm text-muted-foreground rounded-md border p-3">
              Date and time above are in your timezone ({customerTimezone}). Pujari assignment uses the matching
              India Standard Time so there are no scheduling conflicts.
            </p>
          )}
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
                      disabled={(date) => isCalendarDayDisabled(date, bookingLeadHours)}
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
                  <p className="text-sm text-muted-foreground mt-2">{pujarisIncludedShort(selectedPujariCount)}</p>
                </div>
              </div>
              <p>
                <span className="text-muted-foreground">Date: </span>
                {bookingDate ? formatDisplayDate(bookingDate) : "—"} {bookingTime}
                {serviceMode === "virtual" ? ` (${customerTimezone})` : ""}
              </p>
              {serviceMode === "virtual" ? (
                <p>
                  <span className="text-muted-foreground">Country / timezone: </span>
                  {(VIRTUAL_COUNTRIES.find((c) => c.id === customerCountry)?.label || customerCountry)} · {customerTimezone}
                </p>
              ) : (
              <p>
                <span className="text-muted-foreground">Location: </span>
                {composedServiceAddress()}, {city}
              </p>
              )}
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
            <CardContent className="p-6">
              <BookingTotalsSummary />
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">{t("booking.payment")}</h3>

          <Card>
            <CardContent className="p-6">
              <BookingTotalsSummary />
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
        <Button
          variant="outline"
          onClick={() => {
            setStep2Errors({});
            setCurrentStep((s) => (s - 1) as BookingStep);
          }}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> {t("common.back")}
        </Button>
        {currentStep < 4 ? (
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={handleNextStep}
            disabled={currentStep === 1 && serviceMode === "virtual" && vpnBlocked}
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
