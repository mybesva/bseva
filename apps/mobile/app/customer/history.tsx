import { rupees } from "@bseva/config";
import type { Booking } from "@bseva/types";
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
  const q = useQuery({
    queryKey: ["bookings", "history"],
    queryFn: () => apiClient.listBookings({ bucket: "history", limit: 100 }),
  });
  const past = (q.data || []) as Booking[];
  return (
    <Screen>
      <ScreenHeader title={t("mobile.history")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {past.length === 0 ? <EmptyState title={t("mobile.noPastBookings")} /> : null}
        {past.map((b) => (
          <Pressable key={b.id} onPress={() => router.push(`/customer/booking/${b.id}`)}>
            <Card>
              <PujaTitle name={b.service_name} />
              <AppText variant="small">#{b.booking_number}</AppText>
              <AppText variant="small">
                {formatDisplayDate(b.booking_date)}{b.start_time ? ` · ${String(b.start_time).slice(0, 5)}` : ""}
              </AppText>
              <AppText variant="small">{rupees(Number(b.total_paise || 0))}</AppText>
              <StatusBadge status={b.customer_display_status || b.status} />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
