import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MenuProfileHeader } from "@/components/MenuProfileHeader";
import {
  MoreAppearanceRow,
  MoreLanguageRow,
  MoreMenuRow,
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
    { href: "/customer/profile", label: t("mobile.profile"), icon: "person-outline" as const },
    { href: "/customer/address", label: t("mobile.address"), icon: "location-outline" as const },
    { href: "/customer/my-seva", label: t("seva.mySeva"), icon: "flower-outline" as const },
    { href: "/customer/family-sankalp", label: t("seva.familySankalp"), icon: "people-outline" as const },
    { href: "/customer/bookings", label: t("nav.bookings"), icon: "calendar-outline" as const },
    { href: "/customer/invoices", label: t("mobile.invoices"), icon: "document-text-outline" as const },
    { href: "/customer/referral", label: t("nav.referral"), icon: "share-social-outline" as const },
    { href: "/customer/support-contact", label: t("mobile.supportAndContact"), icon: "help-circle-outline" as const },
    { href: "/legal/about", label: t("mobile.about"), icon: "information-circle-outline" as const },
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
