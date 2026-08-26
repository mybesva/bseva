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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useI18n } from "@/i18n/I18nProvider";
import { policyBySlug, useLegalPolicies } from "@/hooks/useLegalPolicies";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BookingWizardProps {
  serviceId: string;
  pujaName: string;
  basePrices: {
    standard: number;
    premium: number;
  };
}

type BookingStep = 1 | 2 | 3 | 4;
type Tier = "standard" | "premium";
type ServiceMode = "physical" | "virtual";
type CalendarType = "north" | "south" | "lunar";

const DEMO_LAT = 12.9352;
const DEMO_LNG = 77.6245;

export default function BookingWizard({ serviceId, pujaName, basePrices }: BookingWizardProps) {
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
  const [bookingTime, setBookingTime] = useState("10:00");
  const [locationText, setLocationText] = useState("Jayanagar 4th Block, Bangalore");
  const [city, setCity] = useState("Bangalore");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [recommendedPriestId, setRecommendedPriestId] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [wallet, setWallet] = useState<{ balance?: number; wallet?: { balance_paise: number } } | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [nearby, setNearby] = useState<any[]>([]);
  const [previous, setPrevious] = useState<any[]>([]);
  const [panchang, setPanchang] = useState<any>(null);
  const settings = { virtualPujaEnabled: "true", gstPercent: "18" };

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
    const qs = new URLSearchParams({ service_id: serviceId, package_type: tier });
    api(`/quote?${qs}`)
      .then(setQuote)
      .catch(() => setQuote(null));
  }, [bookingDate, serviceId, tier]);

  useEffect(() => {
    if (currentStep < 2) return;
    api<any[]>(`/pujaris/nearby?lat=${DEMO_LAT}&lng=${DEMO_LNG}&service_id=${serviceId}`)
      .then((rows) => setNearby(rows.map((p) => ({ ...p, priestId: p.id, approvedLevel: p.approved_level }))))
      .catch(() => setNearby([]));
    if (isAuthenticated) {
      api<any[]>("/pujaris/previous")
        .then((rows) => setPrevious(rows.map((p) => ({ ...p, priestId: p.id }))))
        .catch(() => setPrevious([]));
    }
  }, [currentStep, serviceId, isAuthenticated]);

  const tierDetails = {
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

  const steps = [
    { number: 1, title: t("booking.package") },
    { number: 2, title: t("booking.details") },
    { number: 3, title: t("booking.review") },
    { number: 4, title: t("booking.payment") },
  ];

  const virtualEnabled = settings?.virtualPujaEnabled !== "false";

  const bill = useMemo(() => {
    if (quote) return quote;
    const base = basePrices[tier];
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
      let pujariId = recommendedPriestId;
      if (!pujariId) {
        const list = nearby.length ? nearby : await api<any[]>("/pujaris");
        pujariId = list[0]?.priestId || list[0]?.id;
      }
      if (!pujariId) {
        toast.error("No available pujari for this service");
        return;
      }
      const result = await api<{ booking_number: string; total_paise: number; meeting_url?: string }>("/bookings", {
        method: "POST",
        body: JSON.stringify({
          service_id: serviceId,
          pujari_id: pujariId,
          package_type: tier,
          mode: serviceMode === "virtual" ? "virtual" : "in_person",
          booking_date: format(bookingDate, "yyyy-MM-dd"),
          start_time: bookingTime.length === 5 ? `${bookingTime}:00` : bookingTime,
          location_label: `${locationText}, ${city}`,
          address: locationText,
          latitude: DEMO_LAT,
          longitude: DEMO_LNG,
          terms_accepted: true,
        }),
      });
      toast.success("Booking confirmed and paid from wallet");
      const q = new URLSearchParams({
        number: result.booking_number,
        total: String(result.total_paise),
      });
      if (result.meeting_url) q.set("meet", result.meeting_url);
      setLocation(`/booking-confirmation?${q.toString()}`);
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
                  currentStep >= step.number ? "bg-[#F7931E] text-white" : "bg-gray-200 text-gray-500"
                )}
              >
                {currentStep > step.number ? <Check className="w-5 h-5" /> : step.number}
              </div>
              <span className="text-xs mt-1 text-gray-600">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={cn("w-12 sm:w-20 h-1 mx-2", currentStep > step.number ? "bg-[#F7931E]" : "bg-gray-200")} />
            )}
          </div>
        ))}
      </div>

      {currentStep === 1 && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-[#1E3A5F]">{t("booking.package")}</h3>
          <RadioGroup value={tier} onValueChange={(v) => setTier(v as Tier)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.keys(tierDetails) as Tier[]).map((key) => (
              <Label
                key={key}
                htmlFor={key}
                className={cn(
                  "flex flex-col items-stretch w-full cursor-pointer rounded-lg border-2 p-4 hover:border-[#F7931E]",
                  tier === key ? "border-[#F7931E] bg-orange-50" : "border-gray-200"
                )}
              >
                <RadioGroupItem value={key} id={key} className="sr-only" />
                <div className="flex w-full items-start justify-between gap-3 mb-2">
                  <span className="font-semibold text-[#1E3A5F]">{tierDetails[key].name}</span>
                  <span className="text-lg font-bold text-[#F7931E] shrink-0 whitespace-nowrap">
                    ₹{(basePrices[key] / 100).toLocaleString("en-IN")}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3 w-full leading-relaxed">{tierDetails[key].description}</p>
                <ul className="text-xs text-gray-500 space-y-1 w-full">
                  {tierDetails[key].features.map((f) => (
                    <li key={f} className="flex items-center gap-1">
                      <Check className="w-3 h-3 text-green-500" /> {f}
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
                  "flex flex-col items-start w-full cursor-pointer rounded-lg border-2 p-4",
                  serviceMode === "physical" ? "border-[#F7931E] bg-orange-50" : "border-gray-200"
                )}
              >
                <RadioGroupItem value="physical" className="sr-only" />
                <span className="font-medium">{t("booking.physical")}</span>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Pujari visits your home or venue</p>
              </Label>
              <Label
                className={cn(
                  "flex flex-col items-start w-full cursor-pointer rounded-lg border-2 p-4",
                  !virtualEnabled && "opacity-50 pointer-events-none",
                  serviceMode === "virtual" ? "border-[#F7931E] bg-orange-50" : "border-gray-200"
                )}
              >
                <RadioGroupItem value="virtual" className="sr-only" disabled={!virtualEnabled} />
                <span className="font-medium">{t("booking.virtual")}</span>
                <p className="text-xs text-muted-foreground mt-1">Live video session with your pujari</p>
              </Label>
            </RadioGroup>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-[#1E3A5F]">{t("booking.details")}</h3>

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
            <Popover>
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
                  onSelect={setBookingDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {panchang && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4 text-sm space-y-1">
                  <p className="font-medium text-[#1E3A5F]">{t("calendar.panchangam")}</p>
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
            <Label>Address *</Label>
            <Textarea value={locationText} onChange={(e) => setLocationText(e.target.value)} />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin size={12} /> Used for the in-person visit
            </p>
          </div>
          <div className="space-y-2">
            <Label>City *</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Special Instructions</Label>
            <Textarea value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} />
          </div>

          {previous.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold">{t("booking.previous")}</h4>
              <p className="text-xs text-muted-foreground">Recommendations only — not required to select</p>
              <div className="space-y-2">
                {previous.map((p) => (
                  <button
                    key={p.priestId}
                    type="button"
                    onClick={() => setRecommendedPriestId(p.priestId)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border",
                      recommendedPriestId === p.priestId ? "border-[#F7931E] bg-orange-50" : "border-border"
                    )}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{p.name}</span>
                      <Badge variant="outline">
                        {p.available ? t("booking.available") : t("booking.unavailable")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Previously booked · {p.bookingCount} times</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-semibold">{t("booking.nearby")}</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pujari</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Availability</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nearby.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground text-sm">
                      No nearby pujaris in this radius — pick any approved pujari at payment, or try another location.
                    </TableCell>
                  </TableRow>
                )}
                {nearby.map((p) => (
                  <TableRow
                    key={p.priestId}
                    className={cn("cursor-pointer", recommendedPriestId === p.priestId && "bg-orange-50")}
                    onClick={() => setRecommendedPriestId(p.priestId)}
                  >
                    <TableCell className="font-medium">
                      {p.name}
                      {p.previouslyBooked && (
                        <Badge className="ml-2 bg-blue-100 text-blue-700" variant="outline">
                          Previous
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>L{p.approvedLevel || "—"}</TableCell>
                    <TableCell className="text-right">{p.distanceKm} km</TableCell>
                    <TableCell>{pujaName}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          p.serviceStatus === "Available"
                            ? "bg-green-100 text-green-800"
                            : p.serviceStatus === "Busy"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-700"
                        }
                      >
                        {p.serviceStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">
              Selecting a nearby/previous pujari is optional. Platform can assign later.
            </p>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-[#1E3A5F]">{t("booking.review")}</h3>
          <Card>
            <CardContent className="p-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <div>
                  <p className="text-lg font-semibold">{pujaName}</p>
                  <Badge className="bg-[#F7931E] mt-1">
                    {tierDetails[tier].name} · {serviceMode === "virtual" ? t("booking.virtual") : t("booking.physical")}
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
              {recommendedPriestId && (
                <p>
                  Pujari: {nearby.find((x) => x.priestId === recommendedPriestId)?.name || recommendedPriestId}
                  {nearby.find((x) => x.priestId === recommendedPriestId)?.approvedLevel
                    ? ` · Approved Level ${nearby.find((x) => x.priestId === recommendedPriestId)?.approvedLevel}`
                    : ""}
                </p>
              )}
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3 text-xs space-y-1">
                <p className="font-medium">{cancellationPolicy?.title || "Cancellation Policy"}</p>
                {(cancellationPolicy?.points || []).map((p, i) => (
                  <p key={i}>
                    {p.title ? <strong>{p.title}: </strong> : null}
                    {p.body}
                  </p>
                ))}
              </div>
              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between">
                  <span>Service ({tierDetails[tier].name})</span>
                  <span>₹{(bill.basePrice / 100).toLocaleString("en-IN")}</span>
                </div>
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
                  <span className="text-[#F7931E]">₹{(bill.totalAmount / 100).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-[#1E3A5F]">{t("booking.payment")}</h3>
          {!isAuthenticated && !authLoading && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-6">
                <p className="mb-4 text-sm">Please login as a customer to pay from wallet and confirm booking.</p>
                <Button onClick={() => setLocation(getLoginUrl())} className="bg-[#F7931E]">
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
                  <span className="text-[#F7931E]">₹{(bill.totalAmount / 100).toLocaleString("en-IN")}</span>
                </div>
                <p className="text-xs text-muted-foreground">Paid from the same wallet as mobile (Supabase via FastAPI)</p>
                <div className="flex items-start gap-2 pt-2">
                  <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(!!v)} />
                  <label htmlFor="terms" className="text-sm leading-snug">
                    I agree to the{" "}
                    <button type="button" className="underline text-[#F7931E]" onClick={() => setShowTerms(true)}>
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
            className="bg-[#F7931E] hover:bg-[#e8850d]"
            disabled={!canProceed()}
            onClick={() => setCurrentStep((s) => (s + 1) as BookingStep)}
          >
            {t("common.next")} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          isAuthenticated && (
            <Button
              className="bg-[#F7931E] hover:bg-[#e8850d]"
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
