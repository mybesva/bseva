import { useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MenuProfileHeader } from "@/components/MenuProfileHeader";
import { MoreAppearanceRow, MoreMenuRow } from "@/components/MoreMenuRow";
import { Screen } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { spacing } from "@bseva/tokens";
import type { MoreMenuIcon } from "@/components/MoreMenuRow";

export default function AdminMore() {
  const { logout } = useAuth();
  const { can, badges } = useAdmin();
  const { t } = useI18n();
  const router = useRouter();
  const items: { href: string; label: string; show: boolean; badge?: number; icon: MoreMenuIcon }[] = [
    { href: "/customers", label: t("admin.customers"), show: can("view_customers"), icon: "people-outline" },
    { href: "/temples", label: t("admin.temples"), show: can("manage_services"), icon: "business-outline" },
    { href: "/services", label: t("admin.services"), show: can("manage_services"), icon: "sparkles-outline" },
    { href: "/recommendations", label: t("admin.recommendations"), show: can("manage_services"), icon: "star-outline" },
    { href: "/samagri", label: t("admin.samagri"), show: can("manage_samagri"), icon: "leaf-outline" },
    {
      href: "/virtual-puja",
      label: t("admin.virtualPuja"),
      show: can(["view_bookings", "manage_bookings"]),
      badge: badges.virtual_puja,
      icon: "videocam-outline",
    },
    {
      href: "/muhurtham",
      label: t("admin.muhurtham"),
      show: can(["view_bookings", "manage_bookings"]),
      badge: badges.muhurtham,
      icon: "moon-outline",
    },
    {
      href: "/settlements",
      label: t("admin.settlements"),
      show: can(["manage_settlements", "view_payments"]),
      badge: badges.settlements,
      icon: "cash-outline",
    },
    { href: "/invoices", label: t("admin.invoices"), show: can(["view_payments", "manage_settlements", "manage_bookings"]), icon: "document-text-outline" },
    { href: "/payments", label: t("admin.payments"), show: can(["view_payments", "manage_settlements"]), badge: badges.payments, icon: "card-outline" },
    { href: "/pricing", label: t("admin.pricing"), show: can(["manage_config", "manage_services"]), icon: "pricetag-outline" },
    { href: "/permissions", label: t("admin.permissions"), show: can("manage_admins"), icon: "key-outline" },
    { href: "/reviews", label: t("admin.reviews"), show: can("view_bookings"), icon: "chatbubbles-outline" },
    { href: "/notifications", label: t("admin.notifications"), show: can("manage_config"), icon: "notifications-outline" },
    { href: "/promos", label: t("admin.promos"), show: can("manage_config"), icon: "megaphone-outline" },
    { href: "/reports", label: t("admin.reports"), show: can("view_reports"), icon: "stats-chart-outline" },
    { href: "/bulk-import", label: "Bulk import", show: can("manage_services"), icon: "cloud-upload-outline" },
    { href: "/settings", label: t("admin.settings"), show: can("manage_config"), icon: "settings-outline" },
    { href: "/support", label: t("admin.support"), show: can("manage_support"), icon: "help-circle-outline" },
    { href: "/legal", label: t("admin.legal"), show: can("manage_legal"), icon: "book-outline" },
    { href: "/head-ratings", label: t("admin.headRatings"), show: true, icon: "ribbon-outline" },
  ];

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs }}>
        <MenuProfileHeader />
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl + spacing.lg }}>
        {items
          .filter((item) => item.show)
          .map((item) => (
            <MoreMenuRow
              key={item.href}
              icon={item.icon}
              label={item.label}
              badge={item.badge}
              onPress={() => router.push(item.href as never)}
            />
          ))}
        <MoreAppearanceRow />
        <MoreMenuRow
          icon="log-out-outline"
          label={t("mobile.logout")}
          destructive
          chevron={false}
          onPress={async () => {
            await logout();
            router.replace("/login");
          }}
        />
      </ScrollView>
    </Screen>
  );
}
