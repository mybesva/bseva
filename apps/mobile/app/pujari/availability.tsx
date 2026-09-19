import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { DateCalendar } from "@/components/DateCalendar";
import { AppText, Card, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

export function PujariAvailabilityScreen({ embedded = false }: { embedded?: boolean }) {
  const { t } = useI18n();
  const profile = useQuery({ queryKey: ["pujari-profile"], queryFn: () => apiClient.getPujariProfile() });
  const q = useQuery({ queryKey: ["availability"], queryFn: () => apiClient.availabilityBlocks() });
  const [available, setAvailable] = useState(true);
  const [radius, setRadius] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!profile.data) return;
    setAvailable(!!profile.data.available);
    setRadius(profile.data.service_radius_km != null ? String(profile.data.service_radius_km) : "");
  }, [profile.data]);
  return (
    <Screen>
      {embedded ? (
        <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <AppText variant="h2">{t("nav.availability")}</AppText>
        </SafeAreaView>
      ) : (
        <ScreenHeader title={t("mobile.availability")} back />
      )}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <AppText>{t("mobile.availableBookings")}</AppText>
          <Switch value={available} onValueChange={setAvailable} />
        </View>
        <Field label={t("mobile.serviceRadius")} value={radius} onChangeText={setRadius} keyboardType="number-pad" />
        <PrimaryButton
          title={t("mobile.saveAvailability")}
          onPress={async () => {
            setError(null);
            try {
              await apiClient.patchPujariProfile({ available, service_radius_km: radius ? Number(radius) : null });
              await profile.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : t("mobile.failed"));
            }
          }}
        />
        <AppText variant="h3">{t("mobile.blockedDates")}</AppText>
        <DateCalendar value={date || new Date().toISOString().slice(0, 10)} onChange={setDate} leadHours={1} />
        <Field label={t("mobile.reason")} value={reason} onChangeText={setReason} />
        <PrimaryButton
          title={t("mobile.addBlock")}
          onPress={async () => {
            setError(null);
            try {
              await apiClient.addAvailabilityBlock({ blocked_date: date, reason });
              setDate("");
              await q.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : t("mobile.failed"));
            }
          }}
        />
        {(q.data || []).map((b) => (
          <Card key={b.id}>
            <AppText variant="h3">{b.blocked_date}</AppText>
            <AppText variant="small">{b.reason}</AppText>
            <PrimaryButton
              title={t("mobile.remove")}
              variant="outline"
              onPress={async () => {
                await apiClient.deleteAvailabilityBlock(b.id);
                await q.refetch();
              }}
            />
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

export default function AvailabilityScreen() {
  return <PujariAvailabilityScreen />;
}
