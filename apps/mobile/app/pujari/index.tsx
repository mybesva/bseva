import { rupees } from "@bseva/config";
import type { Booking } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function PujariHome() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const profile = useQuery({ queryKey: ["pujari-profile"], queryFn: () => apiClient.getPujariProfile() });
  const bookings = useQuery({ queryKey: ["bookings"], queryFn: () => apiClient.listBookings() });
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => apiClient.getWallet() as Promise<{ wallet?: { balance_paise?: number } }> });
  const incoming = (bookings.data || []).filter((b) => b.status === "pending_acceptance");
  const ready = (bookings.data || []).filter((b) => b.status === "confirmed");
  const ongoing = (bookings.data || []).filter((b) => b.status === "in_progress");
  const p = profile.data || {};
  const earned = (bookings.data || [])
    .filter((b) => b.status === "completed")
    .reduce((s, b) => s + Number(b.pujari_payable_paise || 0), 0);
  return (
    <Screen>
      <View style={{ backgroundColor: colors.navy, paddingHorizontal: 20, paddingBottom: 24 }}>
        <SafeAreaView edges={["top"]}>
          <AppText variant="h1" color={colors.cream}>
            {t("priest.dashboard")}
          </AppText>
          <AppText color="rgba(255,248,231,0.8)">{user?.name}</AppText>
        </SafeAreaView>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={bookings.isRefetching} onRefresh={() => void bookings.refetch()} />}
      >
        {profile.isLoading ? <LoadingBlock /> : null}
        <Card>
          <AppText variant="small">Verification</AppText>
          <AppText variant="h3">{String(p.verification_status || "pending")}</AppText>
          <AppText variant="small">
            Level requested {String(p.requested_level || "—")} · approved {String(p.approved_level || "—")}
          </AppText>
          {!p.profile_submitted_at ? (
            <View style={{ marginTop: 10 }}>
              <PrimaryButton title="Continue onboarding" onPress={() => router.push("/pujari/onboarding")} />
            </View>
          ) : null}
          {String(p.joining_fee_status) === "pending" ? (
            <View style={{ marginTop: 10 }}>
              <PrimaryButton title="Pay joining fee" variant="outline" onPress={() => void apiClient.payJoiningFee().then(() => profile.refetch())} />
            </View>
          ) : null}
        </Card>
        <Card>
          <AppText variant="small">Completed earnings</AppText>
          <AppText variant="h2" color={colors.primary}>{rupees(earned)}</AppText>
          <AppText variant="small">Wallet {rupees(Number(wallet.data?.wallet?.balance_paise || 0))}</AppText>
        </Card>
        <AppText variant="h2">Awaiting acceptance</AppText>
        {incoming.map((b: Booking) => (
          <Pressable key={b.id} onPress={() => router.push(`/pujari/booking/${b.id}`)}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText variant="h3">{b.service_name}</AppText>
                <StatusBadge status={b.status} />
              </View>
              <AppText variant="small">
                {b.booking_date} · {rupees(b.pujari_payable_paise || b.total_paise)}
              </AppText>
            </Card>
          </Pressable>
        ))}
        {ready.length > 0 ? <AppText variant="h2">Ready to start</AppText> : null}
        {ready.map((b: Booking) => (
          <Pressable key={b.id} onPress={() => router.push(`/pujari/booking/${b.id}`)}>
            <Card>
              <AppText variant="h3">{b.service_name}</AppText>
              <StatusBadge status={b.status} />
            </Card>
          </Pressable>
        ))}
        {ongoing.length > 0 ? <AppText variant="h2">{t("priest.ongoingPuja")}</AppText> : null}
        {ongoing.map((b: Booking) => (
          <Pressable key={b.id} onPress={() => router.push(`/pujari/booking/${b.id}`)}>
            <Card>
              <AppText variant="h3">{b.service_name}</AppText>
              <StatusBadge status={b.status} />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
