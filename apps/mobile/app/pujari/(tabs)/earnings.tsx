import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, LoadingBlock, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function PujariEarnings() {
  const { colors } = useAppTheme();
  const bookings = useQuery({ queryKey: ["bookings"], queryFn: () => apiClient.listBookings() });
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => apiClient.getWallet() as Promise<{ wallet?: { balance_paise?: number } }> });
  const settlements = useQuery({
    queryKey: ["settlements"],
    queryFn: () => apiClient.settlements() as Promise<{ id?: string; amount_paise?: number; status?: string; created_at?: string }[] | { items?: { id?: string; amount_paise?: number; status?: string; created_at?: string }[] }>,
  });
  const rows = bookings.data || [];
  const completed = rows.filter((b) => b.status === "completed");
  const pending = rows.filter((b) => ["confirmed", "in_progress", "pending_acceptance"].includes(b.status));
  const earned = completed.reduce((s, b) => s + Number(b.pujari_payable_paise || 0), 0);
  const pendingAmt = pending.reduce((s, b) => s + Number(b.pujari_payable_paise || 0), 0);
  const settleRows = Array.isArray(settlements.data) ? settlements.data : settlements.data?.items || [];
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">Earnings</AppText>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={bookings.isRefetching} onRefresh={() => void bookings.refetch()} />}
      >
        {bookings.isLoading ? <LoadingBlock /> : null}
        <Card>
          <AppText variant="small">Completed payable</AppText>
          <AppText variant="h1" color={colors.primary}>
            {rupees(earned)}
          </AppText>
        </Card>
        <Card>
          <AppText variant="small">In progress / upcoming</AppText>
          <AppText variant="h2">{rupees(pendingAmt)}</AppText>
        </Card>
        <Card>
          <AppText variant="small">Wallet</AppText>
          <AppText variant="h2">{rupees(Number(wallet.data?.wallet?.balance_paise || 0))}</AppText>
        </Card>
        <AppText variant="h3">Settlements</AppText>
        {settleRows.map((s, i) => (
          <Card key={s.id || i}>
            <AppText>{rupees(Number(s.amount_paise || 0))}</AppText>
            <AppText variant="small">{String(s.status || "")} · {s.created_at}</AppText>
          </Card>
        ))}
        <AppText variant="small" color={colors.mutedForeground}>
          Settlement amounts are calculated by FastAPI after completion.
        </AppText>
      </ScrollView>
    </Screen>
  );
}
