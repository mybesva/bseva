import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView } from "react-native";
import { HomeBrandBar } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, LoadingBlock, Screen } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { badges, can } = useAdmin();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const q = useQuery({ queryKey: ["admin-stats"], queryFn: () => apiClient.adminStats() as Promise<Record<string, unknown>> });
  const stats = q.data || {};
  const ps = (stats.pujariStatus || {}) as Record<string, number>;
  const cards = [
    { title: t("admin.customers"), value: stats.totalCustomers, href: "/customers", show: can("view_customers") },
    { title: t("admin.pujaris"), value: stats.activePriests, href: "/(app)/pujaris", show: can(["view_pujaris", "verify_pujaris"]) },
    { title: t("admin.bookings"), value: stats.totalBookings, href: "/(app)/bookings", show: can(["view_bookings", "manage_bookings"]) },
    { title: t("admin.payments"), value: stats.monthlyRevenue != null ? rupees(Number(stats.monthlyRevenue)) : "—", href: "/payments", show: can(["view_payments"]) },
  ];
  return (
    <Screen>
      <HomeBrandBar subtitle={user?.name} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
      >
        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBanner message={q.error instanceof Error ? q.error.message : "Could not load"} /> : null}
        {cards.filter((c) => c.show).map((c) => (
          <Pressable key={c.title} onPress={() => router.push(c.href as never)}>
            <Card>
              <AppText variant="small">{c.title}</AppText>
              <AppText variant="h1" color={colors.primary}>
                {String(c.value ?? "—")}
              </AppText>
            </Card>
          </Pressable>
        ))}
        <AppText variant="h3">{t("mobile.actionRequired")}</AppText>
        <Card>
          <AppText>{t("admin.bookings")}: {badges.bookings ?? 0}</AppText>
          <AppText>{t("admin.pujaris")}: {badges.pujaris ?? ps.pendingVerification ?? 0}</AppText>
          <AppText>{t("admin.virtualPuja")}: {badges.virtual_puja ?? 0}</AppText>
          <AppText>{t("admin.payments")}: {badges.payments ?? 0}</AppText>
          <AppText>{t("admin.settlements")}: {badges.settlements ?? 0}</AppText>
          <AppText>{t("admin.support")}: {badges.support ?? 0}</AppText>
        </Card>
      </ScrollView>
    </Screen>
  );
}
