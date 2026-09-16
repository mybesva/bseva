import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LanguagePicker } from "@/components/LanguagePicker";
import { AppText, Screen } from "@/components/ui";
import { requestAppPermissions } from "@/utils/permissions";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

export default function CustomerMore() {
  const { colors, toggleTheme, theme } = useAppTheme();
  const { logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const items = [
    { href: "/customer/notifications", label: t("mobile.notifications"), icon: "notifications" as const },
    { href: "/customer/profile", label: t("mobile.profile"), icon: "person" as const },
    { href: "/customer/address", label: t("mobile.address"), icon: "location" as const },
    { href: "/customer/invoices", label: t("mobile.invoices"), icon: "document-text" as const },
    { href: "/customer/rewards", label: t("mobile.rewards"), icon: "gift" as const },
    { href: "/customer/history", label: t("mobile.history"), icon: "time" as const },
    { href: "/customer/astrology", label: t("nav.astrology"), icon: "planet" as const },
    { href: "/customer/support", label: t("mobile.support"), icon: "help-circle" as const },
    { href: "/customer/password", label: t("mobile.password"), icon: "lock-closed" as const },
    { href: "/legal/platform_terms", label: t("mobile.terms"), icon: "book" as const },
    { href: "/legal/privacy", label: t("mobile.privacy"), icon: "shield-checkmark" as const },
  ];
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">{t("mobile.more")}</AppText>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
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
        <View style={{ height: 12 }} />
        <LanguagePicker />
        <Pressable
          onPress={async () => {
            const status = await requestAppPermissions();
            Alert.alert(t("mobile.enablePermissions"), status);
          }}
          style={{ paddingVertical: 14 }}
        >
          <AppText>{t("mobile.enablePermissions")}</AppText>
        </Pressable>
        <Pressable onPress={toggleTheme} style={{ paddingVertical: 14 }}>
          <AppText>
            {t("mobile.theme")}: {theme === "dark" ? t("mobile.themeDark") : t("mobile.themeLight")}
          </AppText>
        </Pressable>
        <Pressable
          onPress={async () => {
            await logout();
            router.replace("/");
          }}
          style={{ paddingVertical: 14 }}
        >
          <AppText color={colors.destructive}>{t("mobile.logout")}</AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
