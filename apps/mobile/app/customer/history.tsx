import { DONE_BOOKING_STATUSES } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, EmptyState, Screen, StatusBadge } from "@/components/ui";
import { apiClient } from "@/services/api";

export default function HistoryScreen() {
  const router = useRouter();
  const q = useQuery({ queryKey: ["bookings"], queryFn: () => apiClient.listBookings() });
  const past = (q.data || []).filter((b) => DONE_BOOKING_STATUSES.includes(b.status as never));
  return (
    <Screen>
      <ScreenHeader title="History" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {past.length === 0 ? <EmptyState title="No past bookings." /> : null}
        {past.map((b) => (
          <Pressable key={b.id} onPress={() => router.push(`/customer/booking/${b.id}`)}>
            <Card>
              <AppText variant="h3">{b.service_name}</AppText>
              <StatusBadge status={b.status} />
              <AppText variant="small">{b.booking_date}</AppText>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
