import {
  bookingLeadHint,
  CALENDARS,
  buildCreateBookingPayload,
  composePhysicalServiceAddress,
  customerBookablePackages,
  isBookingDateTimeBeforeLead,
  isCalendarDayDisabled,
  isDeathRelatedService,
  rupees,
  VIRTUAL_COUNTRIES,
  type CustomerBookablePackage,
} from "@bseva/config";
import type { Quote } from "@bseva/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { BookingMapLocation } from "@/components/BookingMapLocation";
import { DatePickerField } from "@/components/DatePickerField";
import { SelectField } from "@/components/SelectField";
import { MuhurtaConsultation, type MuhurtaReceipt } from "@/components/MuhurtaConsultation";
import { TimePicker } from "@/components/TimePicker";
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
  pkg: CustomerBookablePackage;
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
  selectedDates: string[];
  doorNumber: string;
  landmark: string;
  locationSelection: string;
};

type SavedLocation = {
  id: string;
  label: string;
  city: string;
  lat: number | null;
  lng: number | null;
};

function buildSavedLocation(p: Record<string, string | number | null> | undefined, index = 0): SavedLocation | null {
  if (!p) return null;
  const parts = [p.address_line1, p.address_line2, p.city, p.district, p.state, p.pincode]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  const label =
    String(p.location_label || "").trim() ||
    String(p.address || "").trim() ||
    parts.join(", ");
  const profileCity = String(p.city || "").trim();
  if (!label && !profileCity) return null;
  return {
    id: `saved-${index}`,
    label: label || profileCity,
    city: profileCity,
    lat: p.latitude != null ? Number(p.latitude) : null,
    lng: p.longitude != null ? Number(p.longitude) : null,
  };
}

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
  const [pkg, setPkg] = useState<CustomerBookablePackage>("standard");
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
  const [quote, setQuote] = useState<Quote | null>(null);
  const [includeSamagri, setIncludeSamagri] = useState(false);
  const [includeAlankaram, setIncludeAlankaram] = useState(false);
  const [includeFood, setIncludeFood] = useState(false);
  const [customerCountry, setCustomerCountry] = useState("IN");
  const [customerTimezone, setCustomerTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
    } catch {
      return "Asia/Kolkata";
    }
  });
  const [terms, setTerms] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [recurring, setRecurring] = useState("none");
  const [recurringCount, setRecurringCount] = useState("4");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [doorNumber, setDoorNumber] = useState("");
  const [landmark, setLandmark] = useState("");
  const [locationSelection, setLocationSelection] = useState("new");
  const restoredAddressFromDraft = useRef(false);
  const [muhurtaReceipt, setMuhurtaReceipt] = useState<MuhurtaReceipt | null>(null);
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
        const d = JSON.parse(raw) as Partial<BookingDraft> & { addressMode?: "saved" | "new" };
        if (d.idempotencyKey) setIdempotencyKey(d.idempotencyKey);
        if (d.step) setStep(Math.min(4, Math.max(1, d.step)));
        if (d.pkg === "standard" || d.pkg === "premium") setPkg(d.pkg);
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
        if (d.selectedDates) setSelectedDates(d.selectedDates);
        if (d.doorNumber != null) setDoorNumber(d.doorNumber);
        if (d.landmark != null) setLandmark(d.landmark);
        if (d.locationSelection) setLocationSelection(d.locationSelection);
        else if (d.addressMode === "saved") setLocationSelection("saved-0");
        else if (d.addressMode === "new") setLocationSelection("new");
        restoredAddressFromDraft.current = Boolean(d.address || d.city || d.doorNumber || d.landmark);
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, [slug, initialMode]);

  useEffect(() => {
    if (!slug || !hydrated) return;
    const draft: BookingDraft = {
      idempotencyKey, step, pkg, mode, calendar, date, time, address, city, lat, lng,
      includeSamagri, includeAlankaram, includeFood, customerCountry, customerTimezone,
      instructions, recurring, recurringCount, selectedDates, doorNumber, landmark, locationSelection,
    };
    void AsyncStorage.setItem(`bseva.booking-draft.${slug}`, JSON.stringify(draft));
  }, [slug, hydrated, idempotencyKey, step, pkg, mode, calendar, date, time, address, city, lat, lng, includeSamagri, includeAlankaram, includeFood, customerCountry, customerTimezone, instructions, recurring, recurringCount, selectedDates, doorNumber, landmark, locationSelection]);

  const savedLocations = useMemo((): SavedLocation[] => {
    const one = buildSavedLocation(profileQ.data, 0);
    return one ? [one] : [];
  }, [profileQ.data]);

  const selectedSavedLocation = useMemo(
    () => savedLocations.find((s) => s.id === locationSelection) || null,
    [savedLocations, locationSelection],
  );

  const isNewLocation = locationSelection === "new";

  function applySavedLocation(id: string) {
    const loc = savedLocations.find((s) => s.id === id);
    if (!loc) return;
    setLocationSelection(id);
    setAddress(loc.label);
    setDoorNumber("");
    setLandmark("");
    setCity(loc.city);
    setLat(loc.lat);
    setLng(loc.lng);
  }

  function startNewLocation() {
    setLocationSelection("new");
    setAddress("");
    setDoorNumber("");
    setLandmark("");
    setCity("");
    setLat(null);
    setLng(null);
  }

  function onLocationSelectionChange(id: string) {
    if (id === "new") startNewLocation();
    else applySavedLocation(id);
  }

  const muhurtaNeeded = Boolean(svc?.muhurta_consultation_enabled || svc?.requires_muhurta);
  const leadHours = Number(svc?.booking_lead_hours ?? 48) || 48;
  const deathRelated = Boolean(svc?.death_related) || isDeathRelatedService(svc?.categories || svc?.category);
  const showSamagri = svc?.samagri_available !== false;
  const alankaramPrice = Number(svc?.alankaram_price_paise || quote?.alankaramListPrice || 0);
  const alankaramOffered = !deathRelated && Boolean(svc?.alankaram_available) && alankaramPrice > 0;
  const showFood = Boolean(svc?.food_available);
  const availablePackages = customerBookablePackages({
    standard: svc?.standard_price_paise,
    premium: svc?.premium_price_paise,
  });
  const virtualEnabled =
    Boolean((configQ.data as { virtual_puja_enabled?: boolean } | undefined)?.virtual_puja_enabled) &&
    svc?.virtual_available !== false;
  const tzRows = (configQ.data?.customer_timezones as { id: string; label?: string }[] | undefined) || [];
  const timezoneOptions = (tzRows.length ? tzRows : [{ id: "Asia/Kolkata", label: t("booking.timezoneIndia") }]).map((z) => ({
    id: z.id,
    label: z.label || z.id,
  }));
  const startValidQ = useQuery({
    queryKey: ["validate-booking-start", svc?.id, date, time, mode, customerTimezone],
    queryFn: () =>
      apiClient.validateBookingStart({
        service_id: svc!.id,
        booking_date: date,
        start_time: time.slice(0, 5),
        mode,
        timezone: mode === "virtual" ? customerTimezone : undefined,
      }),
    enabled: !!svc && step >= 2 && /^\d{2}:\d{2}/.test(time),
  });
  const leadBlocked =
    startValidQ.isSuccess && startValidQ.data
      ? !startValidQ.data.valid
      : isBookingDateTimeBeforeLead(date, time, leadHours);

  useEffect(() => {
    if (availablePackages.length && !availablePackages.includes(pkg)) {
      setPkg(availablePackages.includes("standard") ? "standard" : availablePackages[0]);
    }
  }, [availablePackages.join(","), pkg]);

  useEffect(() => {
    if (!virtualEnabled && mode === "virtual") setMode("in_person");
  }, [virtualEnabled, mode]);

  function composedAddress() {
    if (selectedSavedLocation) return selectedSavedLocation.label.trim();
    return composePhysicalServiceAddress({ doorNumber, street: address, landmark });
  }

  function validateStep2(): boolean {
    if (!date) {
      setError(t("booking.needDate"));
      return false;
    }
    const dateObj = new Date(`${date}T12:00:00`);
    if (isCalendarDayDisabled(dateObj, leadHours)) {
      setError(bookingLeadHint(leadHours));
      return false;
    }
    if (!time || !/^\d{2}:\d{2}/.test(time)) {
      setError(t("web.muhurta.needTime"));
      return false;
    }
    if (leadBlocked) {
      setError(bookingLeadHint(leadHours));
      return false;
    }
    if (mode === "in_person") {
      if (!city.trim()) {
        setError(t("booking.needCity"));
        return false;
      }
      if (isNewLocation) {
        if (!doorNumber.trim()) {
          setError(t("booking.needDoor"));
          return false;
        }
        if (!address.trim()) {
          setError(t("booking.needStreet"));
          return false;
        }
        if (lat == null || lng == null) {
          setError(t("booking.needPin"));
          return false;
        }
      } else {
        if (!selectedSavedLocation || !composedAddress().trim()) {
          setError(t("booking.needAddress"));
          return false;
        }
        if (lat == null || lng == null) {
          setError(t("booking.needMap"));
          return false;
        }
      }
    }
    setError(null);
    return true;
  }

  async function loadQuote() {
    if (!svc) return;
    setError(null);
    try {
      const q = await apiClient.quote({
        service_id: svc.id,
        package_type: pkg,
        city: mode === "virtual" ? undefined : city || undefined,
        booking_date: date,
        include_samagri: includeSamagri,
        include_alankaram: includeAlankaram,
        include_food: includeFood,
        country: mode === "virtual" ? customerCountry : undefined,
        mode,
      });
      setQuote(q);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("mobile.quoteFailed"));
    }
  }

  useEffect(() => {
    if (step < 3 || !svc) return;
    const timer = setTimeout(() => void loadQuote(), 250);
    return () => clearTimeout(timer);
  }, [step, svc?.id, pkg, mode, city, date, includeSamagri, includeAlankaram, includeFood, customerCountry]);

  async function checkPhysicalAvailability() {
    if (mode !== "in_person" || lat == null || lng == null || !svc) {
      setServiceAvailable(null);
      return true;
    }
    try {
      const result = await apiClient.serviceAvailability(lat, lng);
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
    if (svc && Boolean(svc.requires_muhurta) && !muhurtaReceipt) {
      setError(t("web.muhurta.needDate"));
      return;
    }
    if (!validateStep2()) return;
    if (!time || !/^\d{2}:\d{2}/.test(time)) {
      setError(t("web.muhurta.needTime"));
      return;
    }
    const dateObj = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`);
    if (isCalendarDayDisabled(dateObj, leadHours)) {
      setError(bookingLeadHint(leadHours));
      return;
    }
    try {
      const leadCheck = await apiClient.validateBookingStart({
        service_id: svc.id,
        booking_date: date,
        start_time: time.slice(0, 5),
        mode,
        timezone: mode === "virtual" ? customerTimezone : undefined,
      });
      if (!leadCheck.valid) {
        setError(bookingLeadHint(leadHours));
        return;
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : bookingLeadHint(leadHours));
      return;
    }
    if (!terms) {
      setError(t("mobile.acceptTerms"));
      return;
    }
    if (mode === "virtual") {
      try {
        const pre = await apiClient.virtualPrecheck({});
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
      if (mode === "in_person" && isNewLocation) {
        const profile = (await apiClient.getCustomerProfile().catch(() => ({}))) as Record<string, unknown>;
        const label = `${composedAddress()}${city ? `, ${city}` : ""}`;
        await apiClient.patchCustomerProfile({
          address_line1: doorNumber.trim() || profile.address_line1,
          address_line2: address.trim() || profile.address_line2,
          city: city.trim() || profile.city,
          district: profile.district,
          state: profile.state,
          pincode: profile.pincode,
          country: profile.country || "India",
          location_label: label,
          latitude: lat,
          longitude: lng,
        });
      }
      const created = await apiClient.createBooking(
        buildCreateBookingPayload({
          service_id: svc.id,
          package_type: pkg,
          mode,
          booking_date: date,
          start_time: time,
          physicalAddress: composedAddress(),
          city,
          latitude: lat,
          longitude: lng,
          special_instructions: instructions || undefined,
          include_samagri: includeSamagri,
          include_alankaram: includeAlankaram,
          include_food: includeFood,
          recurring,
          recurring_count: Number(recurringCount) || undefined,
          selected_dates: selectedDates,
          customer_country: customerCountry,
          customer_timezone: customerTimezone,
          idempotency_key: idempotencyKey,
        }),
        idempotencyKey
      );
      await AsyncStorage.removeItem(`bseva.booking-draft.${slug}`);
      router.replace(`/customer/booking/${(created as { id: string }).id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("mobile.bookingFailed"));
    } finally {
      setPending(false);
    }
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

  if (svc.bookable === false) {
    return (
      <Screen>
        <ScreenHeader title={<PujaTitle name={svc.name} onDark numberOfLines={1} />} back />
        <View style={{ padding: 16, gap: 12 }}>
          <AppText variant="h3">{t("web.book.notOpen")}</AppText>
          <AppText>{t("web.book.notOpenBody")}</AppText>
          <PrimaryButton title={t("web.book.browseServices")} onPress={() => router.replace("/customer/services")} />
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
            {availablePackages.includes("standard") ? (
              <PrimaryButton title={`${t("booking.standard")} ${svc.standard_price_paise ? rupees(svc.standard_price_paise) : ""}`} variant={pkg === "standard" ? "primary" : "outline"} onPress={() => setPkg("standard")} />
            ) : null}
            {availablePackages.includes("premium") ? (
              <PrimaryButton title={`${t("booking.premium")} ${rupees(svc.premium_price_paise)}`} variant={pkg === "premium" ? "primary" : "outline"} onPress={() => setPkg("premium")} />
            ) : null}
            <PrimaryButton title={t("mobile.inPerson")} variant={mode === "in_person" ? "navy" : "outline"} onPress={() => setMode("in_person")} />
            {virtualEnabled ? (
              <PrimaryButton title={t("mobile.virtual")} variant={mode === "virtual" ? "navy" : "outline"} onPress={() => setMode("virtual")} />
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
                {String(panchang.data.tithi || panchang.data.summary || JSON.stringify(panchang.data).slice(0, 180))}
              </AppText>
            ) : null}
            <DatePickerField
              value={date}
              onChange={setDate}
              leadHours={leadHours}
              label={t("booking.selectDate")}
              hint={bookingLeadHint(leadHours)}
            />
            <TimePicker value={time.slice(0, 5) || "10:00"} onChange={setTime} />
            {leadBlocked ? (
              <AppText variant="small" color={colors.mutedForeground}>{bookingLeadHint(leadHours)}</AppText>
            ) : null}
            {mode === "virtual" ? (
              <>
                <AppText variant="small">{t("booking.yourCountry")}</AppText>
                <ChoiceChips
                  options={VIRTUAL_COUNTRIES.map((c) => ({ id: c.id, label: t(`web.country.${c.id}`) === `web.country.${c.id}` ? c.label : t(`web.country.${c.id}`) }))}
                  value={customerCountry}
                  onChange={(v) => setCustomerCountry(String(v))}
                />
                <AppText variant="small">{t("booking.yourTimezone")}</AppText>
                <ChoiceChips options={timezoneOptions} value={customerTimezone} onChange={(v) => setCustomerTimezone(String(v))} />
                <AppText variant="small" color={colors.mutedForeground}>
                  {t("booking.timezoneVirtualHint")}
                </AppText>
              </>
            ) : (
              <>
                {profileQ.isLoading ? (
                  <AppText variant="small" color={colors.mutedForeground}>{t("booking.loadingSavedAddress")}</AppText>
                ) : (
                  <SelectField
                    label={t("booking.selectLocation")}
                    placeholder={t("booking.selectLocation")}
                    value={locationSelection}
                    options={[
                      { id: "new", label: t("booking.addNewLocation") },
                      ...savedLocations.map((loc) => ({
                        id: loc.id,
                        label: loc.label.length > 80 ? `${loc.label.slice(0, 80)}…` : loc.label,
                        subtitle: loc.city || undefined,
                      })),
                    ]}
                    onChange={onLocationSelectionChange}
                  />
                )}
                {!isNewLocation && selectedSavedLocation ? (
                  <Card style={{ gap: 4 }}>
                    <AppText>{selectedSavedLocation.label}</AppText>
                    {selectedSavedLocation.city ? (
                      <AppText variant="small" color={colors.mutedForeground}>
                        {t("web.booking.cityValue", { city: selectedSavedLocation.city })}
                      </AppText>
                    ) : null}
                    {lat != null && lng != null ? (
                      <AppText variant="small" color={colors.mutedForeground}>
                        {t("web.booking.assignedPujariLocation")} · GPS {lat.toFixed(4)}, {lng.toFixed(4)}
                      </AppText>
                    ) : null}
                  </Card>
                ) : (
                  <>
                    <AppText variant="small" color={colors.mutedForeground}>{t("web.booking.newAddress")}</AppText>
                    <Field label={t("booking.doorNumber")} value={doorNumber} onChangeText={setDoorNumber} />
                    <Field
                      label={t("booking.streetPh")}
                      value={address}
                      onChangeText={setAddress}
                      placeholder={t("booking.streetPh")}
                    />
                    <Field label={t("web.booking.landmarkOptional")} value={landmark} onChangeText={setLandmark} placeholder={t("booking.landmarkPh")} />
                    <BookingMapLocation
                      latitude={lat}
                      longitude={lng}
                      onCoordinatesChange={(la, ln) => {
                        setLat(la);
                        setLng(ln);
                      }}
                      onReverseGeocoded={(parts) => {
                        if (parts.door && !doorNumber.trim()) setDoorNumber(parts.door);
                        if (parts.street && !address.trim()) setAddress(parts.street);
                        if (parts.city && !city.trim()) setCity(parts.city);
                      }}
                    />
                  </>
                )}
                <Field label={t("address.city")} value={city} onChangeText={setCity} placeholder={t("address.city")} />
              </>
            )}
            <AppText variant="small">{t("mobile.recurring")}</AppText>
            <ChoiceChips
              options={[
                { id: "none", label: t("booking.recurring.none") },
                { id: "weekly", label: t("booking.recurring.weekly") },
                { id: "monthly", label: t("booking.recurring.monthly") },
                { id: "selected_dates", label: t("booking.recurring.selected") },
              ]}
              value={recurring}
              onChange={(v) => setRecurring(String(v))}
            />
            {recurring !== "none" && recurring !== "selected_dates" ? (
              <Field label={t("mobile.repeatCount")} value={recurringCount} onChangeText={setRecurringCount} keyboardType="number-pad" />
            ) : null}
            {recurring === "selected_dates" ? (
              <>
                <DatePickerField
                  value={date}
                  leadHours={leadHours}
                  label={t("booking.recurring.addDates")}
                  onChange={(iso) => {
                    setSelectedDates((prev) => (prev.includes(iso) ? prev : [...prev, iso].sort()));
                  }}
                />
                {selectedDates.map((d) => (
                  <Pressable key={d} onPress={() => setSelectedDates((prev) => prev.filter((x) => x !== d))}>
                    <AppText>{d}  ×</AppText>
                  </Pressable>
                ))}
              </>
            ) : null}
            {muhurtaNeeded ? (
              <MuhurtaConsultation
                serviceId={svc.id}
                serviceName={svc.name}
                requiresMuhurtham={Boolean(svc.requires_muhurta)}
                feePaise={Number(svc.muhurta_fee_paise || 0)}
                defaultDate={date}
                defaultTime={time || "10:00"}
                receipt={muhurtaReceipt}
                onBooked={setMuhurtaReceipt}
              />
            ) : null}
            <Field
              label={t("mobile.specialInstructions")}
              value={instructions}
              onChangeText={setInstructions}
              multiline
              numberOfLines={6}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton title={t("mobile.back")} variant="outline" onPress={() => setStep(1)} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title={t("booking.review")}
                  disabled={!time || leadBlocked || startValidQ.isFetching}
                  onPress={async () => {
                    if (!validateStep2()) return;
                    await checkPhysicalAvailability();
                    await loadQuote();
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
                    onPress={() => { setMode("virtual"); setServiceAvailable(null); setStep(2); }}
                  />
                ) : null}
                <PrimaryButton
                  title={t("web.booking.connectAdmin")}
                  variant="outline"
                  onPress={() => router.push("/customer/support")}
                />
              </Card>
            ) : null}
            <AppText variant="small" color={colors.mutedForeground}>{t("booking.pujariSharedLater")}</AppText>
            {showSamagri ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <AppText>{t("mobile.includeSamagri")}</AppText>
                <Switch value={includeSamagri} onValueChange={setIncludeSamagri} />
              </View>
            ) : null}
            {alankaramOffered ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <AppText>{t("mobile.includeAlankaram")}</AppText>
                <Switch value={includeAlankaram} onValueChange={setIncludeAlankaram} />
              </View>
            ) : null}
            {showFood ? (
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
                {Number(quote.peakFee) ? <AppText>{t("booking.peakFee")} {rupees(Number(quote.peakFee))}</AppText> : null}
                {Number(quote.discount) ? <AppText>{t("booking.coupon")} {rupees(Number(quote.discount))}</AppText> : null}
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
