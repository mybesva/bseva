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
    { href: "/temples", label: t("admin.temples"), show: can(["view_temples", "manage_temples"]), icon: "business-outline" },
    { href: "/services", label: t("admin.services"), show: can(["view_services", "manage_services"]), icon: "sparkles-outline" },
    { href: "/recommendations", label: t("admin.recommendations"), show: can(["view_recommendations", "manage_recommendations"]), icon: "star-outline" },
    { href: "/samagri", label: t("admin.samagri"), show: can(["view_samagri", "manage_samagri"]), icon: "leaf-outline" },
    {
      href: "/virtual-puja",
      label: t("admin.virtualPuja"),
      show: can(["view_virtual_puja", "manage_virtual_puja"]),
      badge: badges.virtual_puja,
      icon: "videocam-outline",
    },
    {
      href: "/seva-events",
      label: t("admin.sevaEvents"),
      show: can(["view_seva_events", "manage_seva_events"]),
      icon: "calendar-outline",
    },
    {
      href: "/muhurtham",
      label: t("admin.muhurtham"),
      show: can(["view_muhurtham", "manage_muhurtham"]),
      badge: badges.muhurtham,
      icon: "moon-outline",
    },
    {
      href: "/settlements",
      label: t("admin.settlements"),
      show: can("manage_settlements"),
      badge: badges.settlements,
      icon: "cash-outline",
    },
    { href: "/invoices", label: t("admin.invoices"), show: can("view_invoices"), icon: "document-text-outline" },
    { href: "/payments", label: t("admin.payments"), show: can("view_payments"), badge: badges.payments, icon: "card-outline" },
    { href: "/pricing", label: t("admin.pricing"), show: can(["view_pricing", "manage_pricing"]), icon: "pricetag-outline" },
    { href: "/permissions", label: t("admin.permissions"), show: can("manage_admins"), icon: "key-outline" },
    { href: "/reviews", label: t("admin.reviews"), show: can(["view_reviews", "manage_reviews"]), icon: "chatbubbles-outline" },
    { href: "/promos", label: t("admin.promos"), show: can(["view_promotions", "manage_promotions"]), icon: "megaphone-outline" },
    { href: "/reports", label: t("admin.reports"), show: can("view_reports"), icon: "stats-chart-outline" },
    { href: "/bulk-import", label: "Bulk import", show: can("manage_temples"), icon: "cloud-upload-outline" },
    { href: "/settings", label: t("admin.settings"), show: can("manage_config"), icon: "settings-outline" },
    { href: "/support", label: t("admin.support"), show: can("manage_support"), icon: "help-circle-outline" },
    { href: "/legal", label: t("admin.legal"), show: can("manage_legal"), icon: "book-outline" },
    { href: "/head-ratings", label: t("admin.headRatings"), show: can("view_pujaris"), icon: "ribbon-outline" },
    { href: "/about", label: t("mobile.about"), show: true, icon: "information-circle-outline" },
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
