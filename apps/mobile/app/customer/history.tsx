import { DONE_BOOKING_STATUSES } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, EmptyState, Screen, StatusBadge } from "@/components/ui";
import { PujaTitle } from "@/components/PujaTitle";
import { apiClient } from "@/services/api";
import { formatDisplayDate } from "@/utils/formatDate";
import { useI18n } from "@/providers/I18nProvider";

export default function HistoryScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["bookings"], queryFn: () => apiClient.listBookings() });
  const past = (q.data || []).filter((b) => DONE_BOOKING_STATUSES.includes(b.status as never));
  return (
    <Screen>
      <ScreenHeader title={t("mobile.history")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {past.length === 0 ? <EmptyState title={t("mobile.noPastBookings")} /> : null}
        {past.map((b) => (
          <Pressable key={b.id} onPress={() => router.push(`/customer/booking/${b.id}`)}>
            <Card>
              <PujaTitle name={b.service_name} />
              <StatusBadge status={b.customer_display_status || b.status} />
              <AppText variant="small">{formatDisplayDate(b.booking_date)}</AppText>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
