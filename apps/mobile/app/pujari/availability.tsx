import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { DateCalendar } from "@/components/DateCalendar";
import { AppText, Card, Field, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";
import { formatDisplayDate } from "@/utils/formatDate";
import { apiErrorMessage } from "@/utils/userMessage";

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function PujariAvailabilityScreen({ embedded = false }: { embedded?: boolean }) {
  const { t } = useI18n();
  const profile = useQuery({ queryKey: ["pujari-profile"], queryFn: () => apiClient.getPujariProfile() });
  const q = useQuery({ queryKey: ["availability"], queryFn: () => apiClient.availabilityBlocks() });
  const [available, setAvailable] = useState(true);
  const [radius, setRadius] = useState("");
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const blocks = q.data || [];
  const blockedDates = useMemo(() => blocks.map((b) => b.blocked_date), [blocks]);

  useEffect(() => {
    if (!profile.data) return;
    setAvailable(!!profile.data.available);
    setRadius(profile.data.service_radius_km != null ? String(profile.data.service_radius_km) : "");
  }, [profile.data]);

  function handleDateChange(iso: string) {
    setDate(iso);
    const existing = blocks.find((b) => b.blocked_date === iso);
    setReason(existing?.reason || "");
  }

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
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <AppText>{t("mobile.availableBookings")}</AppText>
          <Switch value={available} onValueChange={setAvailable} />
        </View>
        <Field label={t("mobile.serviceRadius")} value={radius} onChangeText={setRadius} keyboardType="number-pad" />
        <PrimaryButton
          title={saving ? t("mobile.saving") : t("mobile.saveAvailability")}
          disabled={saving}
          onPress={async () => {
            setSaving(true);
            try {
              await apiClient.patchPujariProfile({ available, service_radius_km: radius ? Number(radius) : null });
              await profile.refetch();
              Alert.alert(t("mobile.availabilitySaved"));
            } catch (e: unknown) {
              Alert.alert(t("mobile.failed"), apiErrorMessage(t, e, "mobile.failed"));
            } finally {
              setSaving(false);
            }
          }}
        />
        <AppText variant="h3">{t("mobile.blockedDates")}</AppText>
        <DateCalendar
          value={date}
          onChange={handleDateChange}
          blockedDates={blockedDates}
          leadHours={1}
        />
        <Field label={t("mobile.reason")} value={reason} onChangeText={setReason} />
        <PrimaryButton
          title={blocking ? t("web.pujariAvailability.blocking") : t("mobile.addBlock")}
          disabled={blocking}
          onPress={async () => {
            if (!date) {
              Alert.alert(t("mobile.failed"), t("web.pujariAvailability.futureOnly"));
              return;
            }
            setBlocking(true);
            try {
              await apiClient.addAvailabilityBlock({
                blocked_date: date,
                reason: reason.trim() || null,
              });
              await q.refetch();
              Alert.alert(
                t("web.pujariAvailability.blocked"),
                t("mobile.calendarBlocked", { date: formatDisplayDate(date) }),
              );
            } catch (e: unknown) {
              Alert.alert(t("mobile.failed"), apiErrorMessage(t, e, "mobile.failed"));
            } finally {
              setBlocking(false);
            }
          }}
        />
        {blocks.map((b) => (
          <Card key={b.id}>
            <AppText variant="h3">{formatDisplayDate(b.blocked_date)}</AppText>
            <AppText variant="small">{b.reason || t("web.pujariAvailability.noReason")}</AppText>
            <PrimaryButton
              title={t("mobile.remove")}
              variant="outline"
              onPress={async () => {
                try {
                  await apiClient.deleteAvailabilityBlock(b.id);
                  await q.refetch();
                  if (date === b.blocked_date) setReason("");
                  Alert.alert(t("web.pujariAvailability.unblocked"), t("mobile.calendarUnblocked"));
                } catch (e: unknown) {
                  Alert.alert(t("mobile.failed"), apiErrorMessage(t, e, "mobile.failed"));
                }
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
