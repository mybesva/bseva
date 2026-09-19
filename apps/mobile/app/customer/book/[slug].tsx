import { CALENDARS, rupees } from "@bseva/config";
import type { NearbyPujari, Quote } from "@bseva/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PujaTitle } from "@/components/PujaTitle";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";

type BookingDraft = {
  idempotencyKey: string;
  step: number;
  pkg: "basic" | "standard" | "premium";
  mode: "in_person" | "virtual";
  calendar: string;
  date: string;
  time: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  includeSamagri: boolean;
  includeAlankaram: boolean;
  includeFood: boolean;
  customerCountry: string;
  customerTimezone: string;
  instructions: string;
  recurring: string;
  recurringCount: string;
  muhurtaNotes: string;
};

function newIdempotencyKey(slug: string) {
  return `mobile-${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function BookService() {
  const { slug, initialMode } = useLocalSearchParams<{ slug: string; initialMode?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { lang, t } = useI18n();
  const serviceQ = useQuery({ queryKey: ["service", slug, lang], queryFn: () => apiClient.getService(slug), enabled: !!slug });
  const profileQ = useQuery({ queryKey: ["customer-profile"], queryFn: () => apiClient.getCustomerProfile() as Promise<Record<string, string | number | null>> });
  const walletQ = useQuery({ queryKey: ["wallet"], queryFn: () => apiClient.getWallet() as Promise<{ wallet?: { balance_paise?: number }; balance_paise?: number }> });
  const configQ = useQuery({ queryKey: ["public-config"], queryFn: () => apiClient.publicConfig() });
  const svc = serviceQ.data;
  const [step, setStep] = useState(1);
  const [pkg, setPkg] = useState<"basic" | "standard" | "premium">("standard");
  const [mode, setMode] = useState<"in_person" | "virtual">(initialMode === "virtual" ? "virtual" : "in_person");
  const [calendar, setCalendar] = useState(String(user?.calendar_preference || "north"));
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState("10:00");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [pujariId, setPujariId] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyPujari[]>([]);
  const [previous, setPrevious] = useState<NearbyPujari[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [includeSamagri, setIncludeSamagri] = useState(false);
  const [includeAlankaram, setIncludeAlankaram] = useState(false);
  const [includeFood, setIncludeFood] = useState(false);
  const [customerCountry, setCustomerCountry] = useState("IN");
  const [customerTimezone, setCustomerTimezone] = useState("Asia/Kolkata");
  const [terms, setTerms] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [recurring, setRecurring] = useState("none");
  const [recurringCount, setRecurringCount] = useState("4");
  const [muhurtaNotes, setMuhurtaNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey(slug || "service"));
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const panchang = useQuery({
    queryKey: ["panchang", date, calendar],
    queryFn: () => apiClient.panchang(date, calendar) as Promise<Record<string, unknown>>,
    enabled: step >= 2,
  });

  useEffect(() => {
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({});
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
    })();
  }, []);

  useEffect(() => {
    if (!slug) return;
    void AsyncStorage.getItem(`bseva.booking-draft.${slug}`)
      .then((raw) => {
        if (!raw) return;
        const d = JSON.parse(raw) as Partial<BookingDraft>;
        if (d.idempotencyKey) setIdempotencyKey(d.idempotencyKey);
        if (d.step) setStep(Math.min(4, Math.max(1, d.step)));
        if (d.pkg) setPkg(d.pkg);
        if (initialMode === "virtual") setMode("virtual");
        else if (d.mode) setMode(d.mode);
        if (d.calendar) setCalendar(d.calendar);
        if (d.date) setDate(d.date);
        if (d.time) setTime(d.time);
        if (d.address != null) setAddress(d.address);
        if (d.city != null) setCity(d.city);
        if (d.lat != null) setLat(d.lat);
        if (d.lng != null) setLng(d.lng);
        setIncludeSamagri(Boolean(d.includeSamagri));
        setIncludeAlankaram(Boolean(d.includeAlankaram));
        setIncludeFood(Boolean(d.includeFood));
        if (d.customerCountry) setCustomerCountry(d.customerCountry);
        if (d.customerTimezone) setCustomerTimezone(d.customerTimezone);
        if (d.instructions != null) setInstructions(d.instructions);
        if (d.recurring) setRecurring(d.recurring);
        if (d.recurringCount) setRecurringCount(d.recurringCount);
        if (d.muhurtaNotes != null) setMuhurtaNotes(d.muhurtaNotes);
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, [slug, initialMode]);

  useEffect(() => {
    if (!slug || !hydrated) return;
    const draft: BookingDraft = {
      idempotencyKey, step, pkg, mode, calendar, date, time, address, city, lat, lng,
      includeSamagri, includeAlankaram, includeFood, customerCountry, customerTimezone,
      instructions, recurring, recurringCount, muhurtaNotes,
    };
    void AsyncStorage.setItem(`bseva.booking-draft.${slug}`, JSON.stringify(draft));
  }, [slug, hydrated, idempotencyKey, step, pkg, mode, calendar, date, time, address, city, lat, lng, includeSamagri, includeAlankaram, includeFood, customerCountry, customerTimezone, instructions, recurring, recurringCount, muhurtaNotes]);

  useEffect(() => {
    const p = profileQ.data;
    if (!p) return;
    if (!address) setAddress(String(p.address_line1 || p.address || ""));
    if (!city) setCity(String(p.city || ""));
    if (p.latitude != null && lat == null) setLat(Number(p.latitude));
    if (p.longitude != null && lng == null) setLng(Number(p.longitude));
  }, [profileQ.data]);

  const muhurtaNeeded = Boolean(svc?.muhurta_consultation_enabled || svc?.requires_muhurta);

  async function loadQuoteAndPujaris() {
    if (!svc) return;
    setError(null);
    try {
      const q = await apiClient.quote({
        service_id: svc.id,
        package_type: pkg,
        city: city || undefined,
        booking_date: date,
        include_samagri: includeSamagri,
        include_alankaram: includeAlankaram,
        include_food: includeFood,
        country: mode === "virtual" ? customerCountry : undefined,
      });
      setQuote(q);
      const [near, prev] = await Promise.all([
        lat != null && lng != null ? apiClient.nearbyPujaris(lat, lng, svc.id) : Promise.resolve([]),
        apiClient.previousPujaris().catch(() => []),
      ]);
      let rows = near;
      if (!rows.length) rows = await apiClient.listPujaris().catch(() => []);
      setNearby(rows);
      setPrevious(prev);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("mobile.quoteFailed"));
    }
  }

  useEffect(() => {
    if (step < 3 || !svc) return;
    const timer = setTimeout(() => void loadQuoteAndPujaris(), 250);
    return () => clearTimeout(timer);
  }, [step, svc?.id, pkg, mode, city, date, includeSamagri, includeAlankaram, includeFood, customerCountry]);

  async function checkPhysicalAvailability() {
    if (mode !== "in_person" || lat == null || lng == null || !svc) {
      setServiceAvailable(null);
      return true;
    }
    try {
      const result = await apiClient.serviceAvailability(lat, lng, svc.id);
      setServiceAvailable(result.service_available);
      return result.service_available;
    } catch (e: unknown) {
      setServiceAvailable(false);
      setError(e instanceof Error ? e.message : t("web.availability.errorBody"));
      return false;
    }
  }

  async function submit() {
    if (!svc) return;
    if (mode === "in_person" && serviceAvailable === false) {
      setError(t("web.availability.bookingUnavailable"));
      return;
    }
    if (!terms) {
      setError(t("mobile.acceptTerms"));
      return;
    }
    if (mode === "virtual") {
      try {
        const pre = await apiClient.virtualPrecheck({
          service_id: svc.id,
          country: customerCountry,
          timezone: customerTimezone,
        });
        if (pre.blocked) {
          setError(pre.message || t("mobile.virtualUnavailable"));
          return;
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t("mobile.virtualUnavailable"));
        return;
      }
    }
    setPending(true);
    setError(null);
    try {
      if (muhurtaNeeded && muhurtaNotes) {
        try {
          await apiClient.createMuhurta({
            service_id: svc.id,
            appointment_date: date,
            appointment_time: time,
            notes: muhurtaNotes,
          });
        } catch {
          /* consultation is optional if the service already has a booking slot */
        }
      }
      const created = await apiClient.createBooking({
        service_id: svc.id,
        pujari_id: pujariId || undefined,
        package_type: pkg,
        mode,
        booking_date: date,
        start_time: time.length === 5 ? `${time}:00` : time,
        location_label: [address, city].filter(Boolean).join(", "),
        address,
        city,
        latitude: lat,
        longitude: lng,
        special_instructions: instructions || undefined,
        terms_accepted: true,
        include_samagri: includeSamagri,
        include_alankaram: includeAlankaram,
        include_food: includeFood,
        customer_country: mode === "virtual" ? customerCountry : undefined,
        customer_timezone: mode === "virtual" ? customerTimezone : undefined,
        recurring,
        recurring_count: recurring !== "none" ? Number(recurringCount) || undefined : undefined,
      }, idempotencyKey);
      await AsyncStorage.removeItem(`bseva.booking-draft.${slug}`);
      router.replace(`/customer/booking/${(created as { id: string }).id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("mobile.bookingFailed"));
    } finally {
      setPending(false);
    }
  }

  function PujariCard({ p }: { p: NearbyPujari }) {
    return (
      <Pressable onPress={() => setPujariId(p.id)}>
        <Card style={{ borderWidth: pujariId === p.id ? 2 : 0.5, borderColor: pujariId === p.id ? colors.primary : colors.border }}>
          <AppText variant="h3">{p.name}</AppText>
          <AppText variant="small" color={colors.mutedForeground}>
            {t("mobile.pujariLevel", { level: String(p.approved_level ?? "—") })} · {p.distance_km != null ? `${p.distance_km} km` : p.city || ""}
          </AppText>
        </Card>
      </Pressable>
    );
  }

  if (serviceQ.isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t("mobile.book")} back />
        <LoadingBlock />
      </Screen>
    );
  }
  if (!svc) {
    return (
      <Screen>
        <ScreenHeader title={t("mobile.book")} back />
        <View style={{ padding: 16 }}>
          <ErrorBanner message={serviceQ.error instanceof Error ? serviceQ.error.message : t("mobile.serviceNotFound")} />
        </View>
      </Screen>
    );
  }

  const balance = walletQ.data?.wallet?.balance_paise ?? walletQ.data?.balance_paise ?? 0;

  return (
    <Screen>
      <ScreenHeader title={<PujaTitle name={svc.name} onDark numberOfLines={1} />} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <AppText variant="small">{t("mobile.stepOf", { step, total: 4 })}</AppText>
        <ErrorBanner message={error} />
        {step === 1 ? (
          <>
            <AppText variant="h3">{t("mobile.packageMode")}</AppText>
            {svc.basic_price_paise ? (
              <PrimaryButton title={`${t("booking.basic")} ${rupees(svc.basic_price_paise)}`} variant={pkg === "basic" ? "primary" : "outline"} onPress={() => setPkg("basic")} />
            ) : null}
            <PrimaryButton title={`${t("booking.standard")} ${svc.standard_price_paise ? rupees(svc.standard_price_paise) : ""}`} variant={pkg === "standard" ? "primary" : "outline"} onPress={() => setPkg("standard")} />
            {svc.premium_price_paise ? (
              <PrimaryButton title={`${t("booking.premium")} ${rupees(svc.premium_price_paise)}`} variant={pkg === "premium" ? "primary" : "outline"} onPress={() => setPkg("premium")} />
            ) : null}
            <PrimaryButton title={t("mobile.inPerson")} variant={mode === "in_person" ? "navy" : "outline"} onPress={() => setMode("in_person")} />
            {svc.virtual_available ? (
              <PrimaryButton title={t("mobile.virtual")} variant={mode === "virtual" ? "navy" : "outline"} onPress={() => setMode("virtual")} />
            ) : null}
            {mode === "virtual" ? (
              <>
                <Field label={t("mobile.country")} value={customerCountry} onChangeText={setCustomerCountry} autoCapitalize="characters" />
                <Field label={t("mobile.timezone")} value={customerTimezone} onChangeText={setCustomerTimezone} />
              </>
            ) : null}
            <PrimaryButton title={t("mobile.next")} onPress={() => { setServiceAvailable(null); setStep(2); }} />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <AppText variant="small">{t("mobile.calendar")}</AppText>
            <ChoiceChips options={CALENDARS.map((c) => ({ id: c, label: c }))} value={calendar} onChange={(v) => setCalendar(String(v))} />
            {panchang.data ? (
              <AppText variant="small" color={colors.mutedForeground}>
                {String(panchang.data.tithi || panchang.data.summary || JSON.stringify(panchang.data).slice(0, 120))}
              </AppText>
            ) : null}
            <Field label={t("mobile.date")} value={date} onChangeText={setDate} />
            <Field label={t("mobile.startTime")} value={time} onChangeText={setTime} />
            <Field label={t("mobile.address")} value={address} onChangeText={setAddress} />
            <Field label={t("mobile.city")} value={city} onChangeText={setCity} />
            <AppText variant="small">{t("mobile.recurring")}</AppText>
            <ChoiceChips
              options={[
                { id: "none", label: t("booking.recurring.none") },
                { id: "weekly", label: t("booking.recurring.weekly") },
                { id: "monthly", label: t("booking.recurring.monthly") },
              ]}
              value={recurring}
              onChange={(v) => setRecurring(String(v))}
            />
            {recurring !== "none" ? (
              <Field label={t("mobile.repeatCount")} value={recurringCount} onChangeText={setRecurringCount} keyboardType="number-pad" />
            ) : null}
            {muhurtaNeeded ? <Field label={t("mobile.muhurthamNotes")} value={muhurtaNotes} onChangeText={setMuhurtaNotes} /> : null}
            <Field label={t("mobile.specialInstructions")} value={instructions} onChangeText={setInstructions} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton title={t("mobile.back")} variant="outline" onPress={() => setStep(1)} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title={t("booking.review")}
                  onPress={async () => {
                    await checkPhysicalAvailability();
                    await loadQuoteAndPujaris();
                    setStep(3);
                  }}
                />
              </View>
            </View>
          </>
        ) : null}
        {step === 3 ? (
          <>
            {serviceAvailable === false && mode === "in_person" ? (
              <Card style={{ gap: 8, borderColor: colors.warning }}>
                <AppText variant="h3">
                  {String(configQ.data?.service_area_unavailable_heading || t("web.availability.bookingUnavailable"))}
                </AppText>
                <AppText color={colors.mutedForeground}>
                  {String(configQ.data?.service_area_unavailable_description || t("errors.serviceAreaUnavailable"))}
                </AppText>
                {svc.virtual_available && configQ.data?.virtual_puja_enabled ? (
                  <PrimaryButton
                    title={t("web.availability.bookVirtual")}
                    onPress={() => { setMode("virtual"); setServiceAvailable(null); }}
                  />
                ) : null}
              </Card>
            ) : null}
            {previous.length > 0 ? <AppText variant="h3">{t("mobile.previousPujaris")}</AppText> : null}
            {previous.map((p) => (
              <PujariCard key={`p-${p.id}`} p={p} />
            ))}
            <AppText variant="h3">{t("mobile.availablePujaris")}</AppText>
            {nearby.length === 0 ? (
              <Card style={{ gap: 8 }}>
                <AppText variant="h3">{t("web.booking.confirmedAssignmentPending")}</AppText>
                <AppText color={colors.mutedForeground}>{t("web.booking.assignmentPendingBody")}</AppText>
                <PrimaryButton
                  title={t("web.booking.connectAdmin")}
                  variant="outline"
                  onPress={() => router.push("/customer/support")}
                />
                {svc.virtual_available && configQ.data?.virtual_puja_enabled ? (
                  <PrimaryButton
                    title={t("web.availability.bookVirtual")}
                    onPress={() => { setMode("virtual"); setServiceAvailable(null); }}
                  />
                ) : null}
              </Card>
            ) : null}
            {nearby.map((p) => (
              <PujariCard key={p.id} p={p} />
            ))}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <AppText>{t("mobile.includeSamagri")}</AppText>
              <Switch value={includeSamagri} onValueChange={(v) => { setIncludeSamagri(v); }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <AppText>{t("mobile.includeAlankaram")}</AppText>
              <Switch value={includeAlankaram} onValueChange={setIncludeAlankaram} />
            </View>
            {svc.food_available ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <AppText>{t("mobile.includeFood")}</AppText>
                <Switch value={includeFood} onValueChange={setIncludeFood} />
              </View>
            ) : null}
            {quote ? (
              <Card>
                <AppText>{t("mobile.puja")} {rupees(Number(quote.basePrice))}</AppText>
                {Number(quote.samagri) ? <AppText>{t("mobile.samagri")} {rupees(Number(quote.samagri))}</AppText> : null}
                {Number(quote.alankaram) ? <AppText>{t("mobile.alankaram")} {rupees(Number(quote.alankaram))}</AppText> : null}
                {Number(quote.foodPrasadam) ? <AppText>{t("mobile.food")} {rupees(Number(quote.foodPrasadam))}</AppText> : null}
                <AppText>{t("booking.gst")} {rupees(Number(quote.gstAmount))}</AppText>
                <AppText variant="h3">{t("mobile.total")} {rupees(Number(quote.totalAmount))}</AppText>
              </Card>
            ) : null}
            <PrimaryButton title={t("mobile.back")} variant="outline" onPress={() => setStep(2)} />
            <PrimaryButton title={t("booking.payment")} disabled={serviceAvailable === false && mode === "in_person"} onPress={() => setStep(4)} />
          </>
        ) : null}
        {step === 4 ? (
          <>
            <Card>
              <AppText variant="small">{t("mobile.walletBalance")}</AppText>
              <AppText variant="h2" color={colors.primary}>{rupees(Number(balance))}</AppText>
              <AppText variant="small" color={colors.mutedForeground}>
                {t("mobile.walletBookingHelp")}
              </AppText>
            </Card>
            {quote ? <AppText variant="h3">{t("mobile.payAmount", { amount: rupees(Number(quote.totalAmount)) })}</AppText> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Switch value={terms} onValueChange={setTerms} />
              <AppText variant="small" style={{ flex: 1 }}>
                {t("mobile.acceptTerms")}
              </AppText>
            </View>
            <PrimaryButton title={t("mobile.readTerms")} variant="ghost" onPress={() => router.push("/legal/platform_terms")} />
            <PrimaryButton title={t("mobile.back")} variant="outline" onPress={() => setStep(3)} />
            <PrimaryButton title={pending ? t("mobile.booking") : t("mobile.payBook")} loading={pending} onPress={submit} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
