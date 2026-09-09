import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";

export default function AvailabilityScreen() {
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
      <ScreenHeader title="Availability" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <AppText>Available for new bookings</AppText>
          <Switch value={available} onValueChange={setAvailable} />
        </View>
        <Field label="Service radius (km)" value={radius} onChangeText={setRadius} keyboardType="number-pad" />
        <PrimaryButton
          title="Save availability"
          onPress={async () => {
            setError(null);
            try {
              await apiClient.patchPujariProfile({ available, service_radius_km: radius ? Number(radius) : null });
              await profile.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed");
            }
          }}
        />
        <AppText variant="h3">Blocked dates</AppText>
        <Field label="Blocked date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
        <Field label="Reason" value={reason} onChangeText={setReason} />
        <PrimaryButton
          title="Add block"
          onPress={async () => {
            setError(null);
            try {
              await apiClient.addAvailabilityBlock({ blocked_date: date, reason });
              setDate("");
              await q.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed");
            }
          }}
        />
        {(q.data || []).map((b) => (
          <Card key={b.id}>
            <AppText variant="h3">{b.blocked_date}</AppText>
            <AppText variant="small">{b.reason}</AppText>
            <PrimaryButton
              title="Remove"
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
