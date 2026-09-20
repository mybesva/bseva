import { pujariEarningsStats, rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, LoadingBlock, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

export default function PujariEarnings() {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const bookings = useQuery({ queryKey: ["bookings"], queryFn: () => apiClient.listBookings() });
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => apiClient.getWallet() as Promise<{ wallet?: { balance_paise?: number } }> });
  const settlements = useQuery({
    queryKey: ["settlements"],
    queryFn: () => apiClient.settlements() as Promise<{ id?: string; amount_paise?: number; settlement_amount_paise?: number; pujari_amount_paise?: number; status?: string; created_at?: string }[] | { items?: { id?: string; amount_paise?: number; settlement_amount_paise?: number; pujari_amount_paise?: number; status?: string; created_at?: string }[] }>,
  });
  const rows = bookings.data || [];
  const settleRows = Array.isArray(settlements.data) ? settlements.data : settlements.data?.items || [];
  const stats = pujariEarningsStats(rows, settleRows);
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">{t("mobile.earnings")}</AppText>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={bookings.isRefetching} onRefresh={() => void bookings.refetch()} />}
      >
        {bookings.isLoading ? <LoadingBlock /> : null}
        <Card>
          <AppText variant="small">This month</AppText>
          <AppText variant="h1" color={colors.primary}>
            {rupees(stats.thisMonth)}
          </AppText>
        </Card>
        <Card>
          <AppText variant="small">{t("mobile.completedPayable")}</AppText>
          <AppText variant="h2">{rupees(stats.completed)}</AppText>
        </Card>
        <Card>
          <AppText variant="small">{t("mobile.upcomingPayable")}</AppText>
          <AppText variant="h2">{rupees(stats.pending)}</AppText>
        </Card>
        <Card>
          <AppText variant="small">{t("mobile.wallet")}</AppText>
          <AppText variant="h2">{rupees(Number(wallet.data?.wallet?.balance_paise || 0))}</AppText>
        </Card>
        <Card>
          <AppText variant="small">Settled</AppText>
          <AppText variant="h2">{rupees(stats.settled)}</AppText>
        </Card>
        <Card>
          <AppText variant="small">Settlement pending</AppText>
          <AppText variant="h2">{rupees(stats.settlementPending)}</AppText>
        </Card>
        <AppText variant="h3">{t("mobile.settlements")}</AppText>
        {settleRows.map((s, i) => (
          <Card key={s.id || i}>
            <AppText>{rupees(Number(s.settlement_amount_paise || s.amount_paise || s.pujari_amount_paise || 0))}</AppText>
            <AppText variant="small">{String(s.status || "")} · {s.created_at}</AppText>
          </Card>
        ))}
        <AppText variant="small" color={colors.mutedForeground}>
          {t("mobile.settlementHelp")}
        </AppText>
      </ScrollView>
    </Screen>
  );
}
