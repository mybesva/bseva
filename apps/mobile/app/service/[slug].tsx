import { rupees } from "@bseva/config";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

export default function ServiceDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { t, lang } = useI18n();
  const q = useQuery({
    queryKey: ["service", slug, lang],
    queryFn: () => apiClient.getService(slug),
    enabled: !!slug,
  });
  const s = q.data;
  if (q.isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t("services.title")} back />
        <LoadingBlock />
      </Screen>
    );
  }
  if (!s) {
    return (
      <Screen>
        <ScreenHeader title={t("services.title")} back />
        <AppText style={{ padding: 20 }}>{t("mobile.serviceNotFound")}</AppText>
      </Screen>
    );
  }
  return (
    <Screen>
      <ScreenHeader title={s.name} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <Image
          source={{ uri: apiClient.serviceImageUrl(s.slug) }}
          style={{ width: "100%", height: 180, borderRadius: 12, backgroundColor: colors.secondary }}
        />
        <AppText color={colors.mutedForeground}>
          {String(s.full_description || s.description || s.short_description || "")}
        </AppText>
        {s.standard_price_paise != null ? (
          <Card>
            <AppText variant="small">{t("booking.standard")}</AppText>
            <AppText variant="price" color={colors.primary}>
              {rupees(s.standard_price_paise)}
            </AppText>
            {s.premium_price_paise ? (
              <>
                <AppText variant="small" style={{ marginTop: 8 }}>
                  {t("booking.premium")}
                </AppText>
                <AppText variant="price">{rupees(s.premium_price_paise)}</AppText>
              </>
            ) : null}
          </Card>
        ) : (
          <AppText>{t("mobile.notBookable")}</AppText>
        )}
        {s.bookable ? (
          <PrimaryButton
            title={user ? t("mobile.bookPuja") : t("mobile.signInBook")}
            onPress={() => {
              if (!user) router.push({ pathname: "/login", params: { role: "customer" } });
              else router.push(`/customer/book/${s.slug}`);
            }}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
