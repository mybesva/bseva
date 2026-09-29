import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MenuProfileHeader } from "@/components/MenuProfileHeader";
import { MoreAppearanceRow, MoreLanguageRow, MoreMenuRow } from "@/components/MoreMenuRow";
import { Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { shouldShowPujariOnboardingMenu } from "@/utils/pujariVerification";
import { spacing } from "@bseva/tokens";

export default function PujariMore() {
  const { logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const profile = useQuery({ queryKey: ["pujari-profile"], queryFn: () => apiClient.getPujariProfile() });
  const showOnboarding = shouldShowPujariOnboardingMenu(profile.data || {});

  const items = [
    ...(showOnboarding
      ? [{ href: "/pujari/onboarding", label: t("nav.onboarding"), icon: "flag-outline" as const }]
      : []),
    { href: "/pujari/profile", label: t("mobile.profile"), icon: "person-outline" as const },
    { href: "/pujari/documents", label: t("nav.documents"), icon: "document-outline" as const },
    { href: "/pujari/availability", label: t("nav.availability"), icon: "calendar-outline" as const },
    { href: "/pujari/services", label: t("mobile.serviceOffers"), icon: "layers-outline" as const },
    { href: "/pujari/experience", label: t("pujari.experience"), icon: "school-outline" as const },
    { href: "/pujari/seva-events", label: t("seva.pujari.eventsTitle"), icon: "calendar-outline" as const },
    { href: "/pujari/address", label: t("mobile.address"), icon: "location-outline" as const },
    { href: "/pujari/bank", label: t("nav.bank"), icon: "card-outline" as const },
    { href: "/pujari/referral", label: t("nav.referral"), icon: "share-social-outline" as const },
    { href: "/pujari/support-contact", label: t("mobile.supportAndContact"), icon: "help-circle-outline" as const },
    { href: "/legal/about", label: t("mobile.about"), icon: "information-circle-outline" as const },
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
