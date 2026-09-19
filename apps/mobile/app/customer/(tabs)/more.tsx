import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MenuProfileHeader } from "@/components/MenuProfileHeader";
import {
  MoreAppearanceRow,
  MoreLanguageRow,
  MoreMenuRow,
  MorePermissionsRow,
} from "@/components/MoreMenuRow";
import { Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { spacing } from "@bseva/tokens";

export default function CustomerMore() {
  const { logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const items = [
    { href: "/customer/notifications", label: t("mobile.notifications"), icon: "notifications-outline" as const },
    { href: "/customer/profile", label: t("mobile.profile"), icon: "person-outline" as const },
    { href: "/customer/address", label: t("mobile.address"), icon: "location-outline" as const },
    { href: "/customer/invoices", label: t("mobile.invoices"), icon: "document-text-outline" as const },
    { href: "/customer/rewards", label: t("mobile.rewards"), icon: "gift-outline" as const },
    { href: "/customer/history", label: t("mobile.history"), icon: "time-outline" as const },
    { href: "/customer/astrology", label: t("nav.astrology"), icon: "planet-outline" as const },
    { href: "/customer/support", label: t("mobile.support"), icon: "help-circle-outline" as const },
    { href: "/customer/contact", label: t("mobile.contact"), icon: "call-outline" as const },
    { href: "/customer/about", label: t("mobile.about"), icon: "information-circle-outline" as const },
    { href: "/customer/password", label: t("mobile.password"), icon: "lock-closed-outline" as const },
    { href: "/legal/platform_terms", label: t("mobile.terms"), icon: "book-outline" as const },
    { href: "/legal/privacy", label: t("mobile.privacy"), icon: "shield-checkmark-outline" as const },
  ];
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs }}>
        <MenuProfileHeader photoKind="customer" />
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl + spacing.lg }}>
        {items.map((item) => (
          <MoreMenuRow
            key={item.href}
            icon={item.icon}
            label={item.label}
            onPress={() => router.push(item.href as never)}
          />
        ))}
        <MoreLanguageRow />
        <MoreAppearanceRow />
        <MorePermissionsRow />
        <MoreMenuRow
          icon="log-out-outline"
          label={t("mobile.logout")}
          destructive
          chevron={false}
          onPress={async () => {
            await logout();
            router.replace("/");
          }}
        />
      </ScrollView>
    </Screen>
  );
}
