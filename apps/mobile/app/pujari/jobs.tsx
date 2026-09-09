import { rupees } from "@bseva/config";
import type { Booking } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, EmptyState, LoadingBlock, Screen, StatusBadge } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function PujariJobs() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const q = useQuery({ queryKey: ["bookings"], queryFn: () => apiClient.listBookings() });
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">Jobs</AppText>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
      >
        {q.isLoading ? <LoadingBlock /> : null}
        {(q.data || []).length === 0 ? <EmptyState title="No jobs yet." /> : null}
        {(q.data || []).map((b: Booking) => (
          <Pressable key={b.id} onPress={() => router.push(`/pujari/booking/${b.id}`)}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText variant="h3">{b.service_name}</AppText>
                <StatusBadge status={b.status} />
              </View>
              <AppText variant="small" color={colors.mutedForeground}>
                {b.customer_name} · {b.booking_date} {b.start_time}
              </AppText>
              <AppText>{rupees(b.pujari_payable_paise || 0)}</AppText>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
