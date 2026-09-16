import { DONE_BOOKING_STATUSES, rupees } from "@bseva/config";
import type { Booking } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, EmptyState, LoadingBlock, Screen, StatusBadge } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { formatDisplayDate, formatDisplaySlot } from "@/utils/formatDate";
import { useI18n } from "@/providers/I18nProvider";

export default function CustomerBookings() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["bookings"], queryFn: () => apiClient.listBookings() });
  const rows = q.data || [];
  const upcoming = rows.filter((b) => !DONE_BOOKING_STATUSES.includes(b.status as never));
  const past = rows.filter((b) => DONE_BOOKING_STATUSES.includes(b.status as never));
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">{t("mobile.myBookings")}</AppText>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
      >
        {q.isLoading ? <LoadingBlock /> : null}
        {!q.isLoading && rows.length === 0 ? <EmptyState title={t("mobile.noBookings")} subtitle={t("mobile.bookFromServices")} /> : null}
        {upcoming.map((b: Booking) => (
          <Pressable key={b.id} onPress={() => router.push(`/customer/booking/${b.id}`)}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText variant="h3">{b.service_name}</AppText>
                <StatusBadge status={b.status} />
              </View>
              <AppText variant="small" color={colors.mutedForeground}>
                #{b.booking_number} · {formatDisplaySlot(b.booking_date, b.start_time)}
              </AppText>
              <AppText style={{ marginTop: 6 }}>{rupees(b.total_paise)}</AppText>
            </Card>
          </Pressable>
        ))}
        {past.length > 0 ? <AppText variant="h3">{t("mobile.history")}</AppText> : null}
        {past.map((b: Booking) => (
          <Pressable key={b.id} onPress={() => router.push(`/customer/booking/${b.id}`)}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText variant="h3">{b.service_name}</AppText>
                <StatusBadge status={b.status} />
              </View>
              <AppText variant="small">{formatDisplayDate(b.booking_date)}</AppText>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
