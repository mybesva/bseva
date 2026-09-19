import { useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MenuProfileHeader } from "@/components/MenuProfileHeader";
import { MoreAppearanceRow, MoreLanguageRow, MoreMenuRow } from "@/components/MoreMenuRow";
import { Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { spacing } from "@bseva/tokens";

export default function PujariMore() {
  const { logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const items = [
    { href: "/pujari/notifications", label: t("mobile.notifications"), icon: "notifications-outline" as const },
    { href: "/pujari/onboarding", label: t("nav.onboarding"), icon: "flag-outline" as const },
    { href: "/pujari/profile", label: t("mobile.profile"), icon: "person-outline" as const },
    { href: "/pujari/documents", label: t("nav.documents"), icon: "document-outline" as const },
    { href: "/pujari/angikara", label: t("pujari.angikara.title"), icon: "ribbon-outline" as const },
    { href: "/pujari/availability", label: t("nav.availability"), icon: "calendar-outline" as const },
    { href: "/pujari/services", label: t("mobile.serviceOffers"), icon: "layers-outline" as const },
    { href: "/pujari/experience", label: t("pujari.experience"), icon: "school-outline" as const },
    { href: "/pujari/address", label: t("mobile.address"), icon: "location-outline" as const },
    { href: "/pujari/bank", label: t("nav.bank"), icon: "card-outline" as const },
    { href: "/pujari/referral", label: t("mobile.rewards"), icon: "gift-outline" as const },
    { href: "/pujari/ratings", label: t("admin.headRatings"), icon: "star-outline" as const },
    { href: "/pujari/support", label: t("mobile.support"), icon: "help-circle-outline" as const },
    { href: "/pujari/password", label: t("mobile.password"), icon: "lock-closed-outline" as const },
    { href: "/legal/platform_terms", label: t("mobile.terms"), icon: "book-outline" as const },
    { href: "/legal/privacy", label: t("mobile.privacy"), icon: "shield-checkmark-outline" as const },
  ];
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs }}>
        <MenuProfileHeader photoKind="pujari" />
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
