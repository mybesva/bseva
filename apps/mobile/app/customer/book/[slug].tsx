import { CALENDARS, rupees } from "@bseva/config";
import type { NearbyPujari, Quote } from "@bseva/types";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useAuth } from "@/providers/AuthProvider";

export default function BookService() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const serviceQ = useQuery({ queryKey: ["service", slug], queryFn: () => apiClient.getService(slug), enabled: !!slug });
  const profileQ = useQuery({ queryKey: ["customer-profile"], queryFn: () => apiClient.getCustomerProfile() as Promise<Record<string, string | number | null>> });
  const walletQ = useQuery({ queryKey: ["wallet"], queryFn: () => apiClient.getWallet() as Promise<{ wallet?: { balance_paise?: number }; balance_paise?: number }> });
  const svc = serviceQ.data;
  const [step, setStep] = useState(1);
  const [pkg, setPkg] = useState<"standard" | "premium">("standard");
  const [mode, setMode] = useState<"in_person" | "virtual">("in_person");
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
  const [terms, setTerms] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [recurring, setRecurring] = useState("none");
  const [recurringCount, setRecurringCount] = useState("4");
  const [muhurtaNotes, setMuhurtaNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
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
      setError(e instanceof Error ? e.message : "Could not load quote");
    }
  }

  async function submit() {
    if (!svc) return;
    if (!pujariId) {
      setError("Select a pujari");
      return;
    }
    if (!terms) {
      setError("Please accept the Terms & Conditions and Cancellation Policy");
      return;
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
        pujari_id: pujariId,
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
        include_food: false,
        recurring,
        recurring_count: recurring !== "none" ? Number(recurringCount) || undefined : undefined,
      });
      router.replace(`/customer/booking/${(created as { id: string }).id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Booking failed");
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
            Level {p.approved_level ?? "—"} · {p.distance_km != null ? `${p.distance_km} km` : p.city || ""}
          </AppText>
        </Card>
      </Pressable>
    );
  }

  if (serviceQ.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Book" back />
        <LoadingBlock />
      </Screen>
    );
  }
  if (!svc) {
    return (
      <Screen>
        <ScreenHeader title="Book" back />
        <View style={{ padding: 16 }}>
          <ErrorBanner message={serviceQ.error instanceof Error ? serviceQ.error.message : "Service not found"} />
        </View>
      </Screen>
    );
  }

  const balance = walletQ.data?.wallet?.balance_paise ?? walletQ.data?.balance_paise ?? 0;

  return (
    <Screen>
      <ScreenHeader title={`Book ${svc.name}`} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <AppText variant="small">Step {step} of 4</AppText>
        <ErrorBanner message={error} />
        {step === 1 ? (
          <>
            <AppText variant="h3">Package & mode</AppText>
            <PrimaryButton title={`Standard ${svc.standard_price_paise ? rupees(svc.standard_price_paise) : ""}`} variant={pkg === "standard" ? "primary" : "outline"} onPress={() => setPkg("standard")} />
            {svc.premium_price_paise ? (
              <PrimaryButton title={`Premium ${rupees(svc.premium_price_paise)}`} variant={pkg === "premium" ? "primary" : "outline"} onPress={() => setPkg("premium")} />
            ) : null}
            <PrimaryButton title="In-person" variant={mode === "in_person" ? "navy" : "outline"} onPress={() => setMode("in_person")} />
            {svc.virtual_available ? (
              <PrimaryButton title="Virtual" variant={mode === "virtual" ? "navy" : "outline"} onPress={() => setMode("virtual")} />
            ) : null}
            <PrimaryButton title="Next" onPress={() => setStep(2)} />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <AppText variant="small">Calendar</AppText>
            <ChoiceChips options={CALENDARS.map((c) => ({ id: c, label: c }))} value={calendar} onChange={(v) => setCalendar(String(v))} />
            {panchang.data ? (
              <AppText variant="small" color={colors.mutedForeground}>
                {String(panchang.data.tithi || panchang.data.summary || JSON.stringify(panchang.data).slice(0, 120))}
              </AppText>
            ) : null}
            <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
            <Field label="Start time (HH:MM)" value={time} onChangeText={setTime} />
            <Field label="Address" value={address} onChangeText={setAddress} />
            <Field label="City" value={city} onChangeText={setCity} />
            <AppText variant="small">Recurring</AppText>
            <ChoiceChips
              options={[
                { id: "none", label: "Once" },
                { id: "weekly", label: "Weekly" },
                { id: "monthly", label: "Monthly" },
              ]}
              value={recurring}
              onChange={(v) => setRecurring(String(v))}
            />
            {recurring !== "none" ? (
              <Field label="Repeat count" value={recurringCount} onChangeText={setRecurringCount} keyboardType="number-pad" />
            ) : null}
            {muhurtaNeeded ? <Field label="Muhurta notes (optional)" value={muhurtaNotes} onChangeText={setMuhurtaNotes} /> : null}
            <Field label="Special instructions" value={instructions} onChangeText={setInstructions} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton title="Back" variant="outline" onPress={() => setStep(1)} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title="Review"
                  onPress={async () => {
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
            {previous.length > 0 ? <AppText variant="h3">Previous pujaris</AppText> : null}
            {previous.map((p) => (
              <PujariCard key={`p-${p.id}`} p={p} />
            ))}
            <AppText variant="h3">Available pujaris</AppText>
            {nearby.length === 0 ? (
              <AppText color={colors.mutedForeground}>No nearby pujaris found. Enable location or try another city.</AppText>
            ) : null}
            {nearby.map((p) => (
              <PujariCard key={p.id} p={p} />
            ))}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <AppText>Include samagri</AppText>
              <Switch value={includeSamagri} onValueChange={(v) => { setIncludeSamagri(v); }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <AppText>Include alankaram</AppText>
              <Switch value={includeAlankaram} onValueChange={setIncludeAlankaram} />
            </View>
            <PrimaryButton title="Refresh quote" variant="outline" onPress={() => void loadQuoteAndPujaris()} />
            {quote ? (
              <Card>
                <AppText>Puja {rupees(Number(quote.basePrice))}</AppText>
                {Number(quote.samagri) ? <AppText>Samagri {rupees(Number(quote.samagri))}</AppText> : null}
                {Number(quote.alankaram) ? <AppText>Alankaram {rupees(Number(quote.alankaram))}</AppText> : null}
                <AppText>GST {rupees(Number(quote.gstAmount))}</AppText>
                <AppText variant="h3">Total {rupees(Number(quote.totalAmount))}</AppText>
              </Card>
            ) : null}
            <PrimaryButton title="Back" variant="outline" onPress={() => setStep(2)} />
            <PrimaryButton title="Payment" onPress={() => setStep(4)} />
          </>
        ) : null}
        {step === 4 ? (
          <>
            <Card>
              <AppText variant="small">Wallet balance</AppText>
              <AppText variant="h2" color={colors.primary}>{rupees(Number(balance))}</AppText>
              <AppText variant="small" color={colors.mutedForeground}>
                The server charges this booking from your wallet. Cancellation fees are also calculated on the server.
              </AppText>
            </Card>
            {quote ? <AppText variant="h3">Pay {rupees(Number(quote.totalAmount))}</AppText> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Switch value={terms} onValueChange={setTerms} />
              <AppText variant="small" style={{ flex: 1 }}>
                I accept the Terms & Conditions and Cancellation Policy.
              </AppText>
            </View>
            <PrimaryButton title="Back" variant="outline" onPress={() => setStep(3)} />
            <PrimaryButton title={pending ? "Booking..." : "Pay with wallet & book"} loading={pending} onPress={submit} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
