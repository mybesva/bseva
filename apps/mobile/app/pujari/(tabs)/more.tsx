import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LanguagePicker } from "@/components/LanguagePicker";
import { AppText, Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

export default function PujariMore() {
  const { colors, toggleTheme, theme } = useAppTheme();
  const { logout, user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const items = [
    { href: "/pujari/notifications", label: t("mobile.notifications"), icon: "notifications" as const },
    { href: "/pujari/onboarding", label: t("nav.onboarding"), icon: "flag" as const },
    { href: "/pujari/profile", label: t("mobile.profile"), icon: "person" as const },
    { href: "/pujari/documents", label: t("nav.documents"), icon: "document" as const },
    { href: "/pujari/angikara", label: t("pujari.angikara.title"), icon: "ribbon" as const },
    { href: "/pujari/availability", label: t("nav.availability"), icon: "calendar" as const },
    { href: "/pujari/services", label: t("mobile.serviceOffers"), icon: "layers" as const },
    { href: "/pujari/experience", label: t("pujari.experience"), icon: "school" as const },
    { href: "/pujari/address", label: t("mobile.address"), icon: "location" as const },
    { href: "/pujari/bank", label: t("nav.bank"), icon: "card" as const },
    { href: "/pujari/referral", label: t("mobile.rewards"), icon: "gift" as const },
    { href: "/pujari/ratings", label: t("admin.headRatings"), icon: "star" as const },
    { href: "/pujari/support", label: t("mobile.support"), icon: "help-circle" as const },
    { href: "/pujari/password", label: t("mobile.password"), icon: "lock-closed" as const },
    { href: "/legal/platform_terms", label: t("mobile.terms"), icon: "book" as const },
    { href: "/legal/privacy", label: t("mobile.privacy"), icon: "shield-checkmark" as const },
  ];
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">{t("mobile.more")}</AppText>
        <AppText variant="small">{user?.name}</AppText>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {items.map((item) => (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href as never)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }}
          >
            <Ionicons name={item.icon} size={20} color={colors.primary} />
            <AppText style={{ flex: 1 }}>{item.label}</AppText>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>
        ))}
        <LanguagePicker />
        <Pressable onPress={toggleTheme} style={{ paddingVertical: 12 }}>
          <AppText>
            {t("mobile.theme")}: {theme === "dark" ? t("mobile.themeDark") : t("mobile.themeLight")}
          </AppText>
        </Pressable>
        <Pressable
          onPress={async () => {
            await logout();
            router.replace("/");
          }}
        >
          <AppText color={colors.destructive}>{t("mobile.logout")}</AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
