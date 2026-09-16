import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Screen } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

export default function AdminMore() {
  const { colors, toggleTheme, theme } = useAppTheme();
  const { logout, user } = useAuth();
  const { can, badges } = useAdmin();
  const { t } = useI18n();
  const router = useRouter();
  const items = [
    { href: "/customers", label: t("admin.customers"), show: can("view_customers"), badge: 0 },
    { href: "/temples", label: t("admin.temples"), show: can("manage_services") },
    { href: "/services", label: t("admin.services"), show: can("manage_services") },
    { href: "/recommendations", label: t("admin.recommendations"), show: can("manage_services") },
    { href: "/samagri", label: t("admin.samagri"), show: can("manage_samagri") },
    { href: "/virtual-puja", label: t("admin.virtualPuja"), show: can(["view_bookings", "manage_bookings"]), badge: badges.virtual_puja },
    { href: "/settlements", label: t("admin.settlements"), show: can(["manage_settlements", "view_payments"]), badge: badges.settlements },
    { href: "/invoices", label: t("admin.invoices"), show: can(["view_payments", "manage_settlements", "manage_bookings"]) },
    { href: "/payments", label: t("admin.payments"), show: can(["view_payments", "manage_settlements"]), badge: badges.payments },
    { href: "/pricing", label: t("admin.pricing"), show: can(["manage_config", "manage_services"]) },
    { href: "/permissions", label: t("admin.permissions"), show: can("manage_admins") },
    { href: "/reviews", label: t("admin.reviews"), show: can("view_bookings") },
    { href: "/notifications", label: t("admin.notifications"), show: can("manage_config") },
    { href: "/promos", label: t("admin.promos"), show: can(["manage_config", "manage_promotions"]) },
    { href: "/reports", label: t("admin.reports"), show: can("view_reports") },
    { href: "/settings", label: t("admin.settings"), show: can("manage_config") },
    { href: "/support", label: t("admin.support"), show: can("manage_support") },
    { href: "/legal", label: t("admin.legal"), show: can("manage_legal") },
    { href: "/head-ratings", label: t("admin.headRatings"), show: true },
  ].filter((i) => i.show);

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">{t("mobile.more")}</AppText>
        <AppText variant="small">
          {user?.name} · {user?.role}
        </AppText>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {items.map((item) => (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href as never)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }}
          >
            <AppText style={{ flex: 1 }}>{item.label}</AppText>
            {item.badge ? <AppText color={colors.primary}>{item.badge}</AppText> : null}
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>
        ))}
        <Pressable onPress={toggleTheme} style={{ paddingVertical: 12 }}>
          <AppText>
            {t("mobile.theme")}: {theme === "dark" ? t("mobile.themeDark") : t("mobile.themeLight")}
          </AppText>
        </Pressable>
        <Pressable
          onPress={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          <AppText color={colors.destructive}>{t("mobile.logout")}</AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
