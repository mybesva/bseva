import { isAdminRole, rupees } from "@bseva/config";
import { spacing } from "@bseva/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import type { ComponentProps } from "react";
import { HomeBrandBar } from "@/components/ScreenHeader";
import { AppText, ErrorBanner, LoadingBlock, Screen } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type ActionIcon = ComponentProps<typeof Ionicons>["name"];

function dashboardTitle(role: string | undefined) {
  if (role === "super_admin") return "B-Seva Super Admin";
  if (isAdminRole(role)) return "B-Seva Admin";
  return "B-Seva Admin";
}

function KpiTile({
  title,
  value,
  onPress,
}: {
  title: string;
  value: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${value}`}
      style={({ pressed }) => [styles.kpiTile, { opacity: pressed ? 0.82 : 1 }]}
    >
      <View
        style={[
          styles.kpiInner,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="h2" color={colors.primary} numberOfLines={1}>
          {value}
        </AppText>
      </View>
    </Pressable>
  );
}

function ActionRow({
  label,
  count,
  icon,
  onPress,
  last = false,
}: {
  label: string;
  count: number;
  icon: ActionIcon;
  onPress: () => void;
  last?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count} pending`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        minHeight: 44,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        opacity: pressed ? 0.72 : 1,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      })}
    >
      <Ionicons name={icon} size={18} color={colors.primary} style={{ width: 24 }} />
      <AppText style={{ flex: 1, marginLeft: spacing.sm, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
        {label}
      </AppText>
      <View
        style={{
          minWidth: 24,
          height: 24,
          borderRadius: 12,
          paddingHorizontal: 7,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primary + "18",
        }}
      >
        <AppText variant="small" color={colors.primary} style={{ fontWeight: "700" }}>
          {count}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} style={{ marginLeft: spacing.xs }} />
    </Pressable>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { badges, can } = useAdmin();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const q = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => apiClient.adminStats() as Promise<Record<string, unknown>>,
  });
  const stats = q.data || {};

  const kpiCards = [
    {
      title: t("admin.customers"),
      value: String(stats.totalCustomers ?? "—"),
      href: "/customers",
      show: can("view_customers"),
    },
    {
      title: t("admin.pujaris"),
      value: String(stats.activePriests ?? "—"),
      href: "/(app)/pujaris?status=approved",
      show: can(["view_pujaris", "verify_pujaris"]),
    },
    {
      title: t("admin.bookings"),
      value: String(stats.totalBookings ?? "—"),
      href: "/(app)/bookings",
      show: can(["view_bookings", "manage_bookings"]),
    },
    {
      title: "Revenue",
      value: stats.monthlyRevenue != null ? rupees(Number(stats.monthlyRevenue)) : "—",
      href: "/payments",
      show: can(["view_payments"]),
    },
  ].filter((c) => c.show);

  const actionItems = [
    {
      key: "bookings",
      label: t("admin.bookings"),
      count: badges.bookings ?? 0,
      icon: "calendar-outline" as ActionIcon,
      href: "/(app)/bookings?status=needs_reassignment",
      show: can(["view_bookings", "manage_bookings"]),
    },
    {
      key: "pujaris",
      label: t("admin.pujaris"),
      count: badges.pujaris ?? 0,
      icon: "people-outline" as ActionIcon,
      href: "/(app)/pujaris?status=pending",
      show: can(["view_pujaris", "verify_pujaris"]),
    },
    {
      key: "virtual_puja",
      label: t("admin.virtualPuja"),
      count: badges.virtual_puja ?? 0,
      icon: "videocam-outline" as ActionIcon,
      href: "/virtual-puja?status=needs_reassignment",
      show: can(["view_bookings", "manage_bookings"]),
    },
    {
      key: "payments",
      label: t("admin.payments"),
      count: badges.payments ?? 0,
      icon: "card-outline" as ActionIcon,
      href: "/payments?status=failed",
      show: can(["view_payments"]),
    },
    {
      key: "settlements",
      label: t("admin.settlements"),
      count: badges.settlements ?? 0,
      icon: "cash-outline" as ActionIcon,
      href: "/settlements?status=awaiting",
      show: can(["manage_settlements", "view_payments"]),
    },
    {
      key: "support",
      label: t("admin.support"),
      count: badges.support ?? 0,
      icon: "help-circle-outline" as ActionIcon,
      href: "/support?status=open",
      show: can("manage_support"),
    },
  ]
    .filter((item) => item.show && item.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <Screen watermark={false}>
      <HomeBrandBar title={dashboardTitle(user?.role)} subtitle={user?.name} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
      >
        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBanner message={q.error instanceof Error ? q.error.message : "Could not load"} /> : null}

        {kpiCards.length > 0 ? (
          <View style={styles.kpiGrid}>
            {kpiCards.map((c) => (
              <KpiTile
                key={c.title}
                title={c.title}
                value={c.value}
                onPress={() => router.push(c.href as never)}
              />
            ))}
          </View>
        ) : null}

        {actionItems.length > 0 ? (
          <View style={{ gap: 6 }}>
            <AppText variant="h3">{t("mobile.actionRequired")}</AppText>
            <View
              style={[
                styles.actionPanel,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {actionItems.map((item, index) => (
                <ActionRow
                  key={item.key}
                  label={item.label}
                  count={item.count}
                  icon={item.icon}
                  last={index === actionItems.length - 1}
                  onPress={() => router.push(item.href as never)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kpiTile: {
    width: "48%",
    flexGrow: 1,
  },
  kpiInner: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
    minHeight: 72,
    justifyContent: "center",
  },
  actionPanel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
});
