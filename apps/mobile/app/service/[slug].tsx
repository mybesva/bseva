import { rupees } from "@bseva/config";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function ServiceDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const q = useQuery({
    queryKey: ["service", slug],
    queryFn: () => apiClient.getService(slug),
    enabled: !!slug,
  });
  const s = q.data;
  if (q.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Service" back />
        <LoadingBlock />
      </Screen>
    );
  }
  if (!s) {
    return (
      <Screen>
        <ScreenHeader title="Service" back />
        <AppText style={{ padding: 20 }}>Service not found.</AppText>
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
            <AppText variant="small">Standard</AppText>
            <AppText variant="price" color={colors.primary}>
              {rupees(s.standard_price_paise)}
            </AppText>
            {s.premium_price_paise ? (
              <>
                <AppText variant="small" style={{ marginTop: 8 }}>
                  Premium
                </AppText>
                <AppText variant="price">{rupees(s.premium_price_paise)}</AppText>
              </>
            ) : null}
          </Card>
        ) : (
          <AppText>This service is not yet available for booking.</AppText>
        )}
        {s.bookable ? (
          <PrimaryButton
            title={user ? "Book this puja" : "Sign in to book"}
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
