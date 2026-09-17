import { isAdminRole, isPujariRole, rupees } from "@bseva/config";
import type { CatalogService } from "@bseva/types";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, LoadingBlock, PrimaryButton } from "@/components/ui";
import { BrandLockup } from "@/components/BrandLockup";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { LanguagePicker } from "@/components/LanguagePicker";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function LandingScreen() {
  const { user, loading } = useAuth();
  const { t, lang } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [q, setQ] = useState("");

  const popular = useQuery({
    queryKey: ["services", "featured", lang],
    queryFn: () => apiClient.listServices({ featured: 1 }),
  });

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.navy, justifyContent: "center" }}>
        <LoadingBlock />
      </View>
    );
  }
  if (user) {
    if (isAdminRole(user.role)) return <Redirect href="/admin-web" />;
    if (isPujariRole(user.role)) return <Redirect href="/pujari" />;
    return <Redirect href="/customer" />;
  }

  const services = (popular.data || []).slice(0, 8);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <ImageBackground
          source={{ uri: "https://images.unsplash.com/photo-1604608672516-f1b249e2312f?w=1200&q=60" }}
          style={{ minHeight: 420, justifyContent: "flex-end" }}
        >
          <View style={{ backgroundColor: "rgba(26,43,74,0.72)", paddingTop: 56, paddingBottom: 28, paddingHorizontal: 20 }}>
            <SafeAreaView edges={["top"]}>
              <View style={{ marginBottom: 16, alignSelf: "center" }}>
                <BrandLockup markSize={64} light />
              </View>
              <View
                style={{
                  alignSelf: "flex-start",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.3)",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  marginBottom: 16,
                }}
              >
                <AppText variant="eyebrow" color="#fff">
                  {t("home.badge")}
                </AppText>
              </View>
              <AppText variant="display" color="#fff">
                {t("home.heroTitle1")}
              </AppText>
              <AppText variant="display" color={colors.primary}>
                {t("home.heroTitle2")}
              </AppText>
              <AppText color="rgba(255,255,255,0.9)" style={{ marginTop: 12, marginBottom: 20 }}>
                {t("home.heroDesc")}
              </AppText>
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 6,
                  gap: 8,
                }}
              >
                <Ionicons name="search" size={18} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder={t("home.searchPujas")}
                  placeholderTextColor={colors.mutedForeground}
                  style={{ flex: 1, color: colors.foreground, paddingVertical: 10 }}
                  onSubmitEditing={() =>
                    router.push({ pathname: "/browse-services", params: { q } } as never)
                  }
                />
                <Pressable
                  onPress={() => router.push({ pathname: "/browse-services", params: { q } } as never)}
                  style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 }}
                >
                  <AppText variant="small" color={colors.primaryForeground} style={{ fontWeight: "700" }}>
                    {t("home.search")}
                  </AppText>
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </ImageBackground>

        <View style={{ padding: 20, gap: 16 }}>
          <LanguagePicker />
          <AppText variant="h2">{t("home.choosePortal")}</AppText>
          <Card>
            <Ionicons name="people" size={28} color={colors.primary} />
            <AppText variant="h3" style={{ marginTop: 8 }}>
              {t("auth.customer")}
            </AppText>
            <AppText variant="small" color={colors.mutedForeground} style={{ marginVertical: 8 }}>
              {t("home.customerBlurb")}
            </AppText>
            <View style={{ gap: 8 }}>
              <PrimaryButton title={t("mobile.loginAsCustomer")} onPress={() => router.push({ pathname: "/login", params: { role: "customer" } })} />
              <PrimaryButton title={t("mobile.registerAsCustomer")} variant="outline" onPress={() => router.push({ pathname: "/register", params: { role: "customer" } })} />
            </View>
          </Card>
          <Card>
            <Ionicons name="flower" size={28} color={colors.primary} />
            <AppText variant="h3" style={{ marginTop: 8 }}>
              {t("auth.pujari")}
            </AppText>
            <AppText variant="small" color={colors.mutedForeground} style={{ marginVertical: 8 }}>
              {t("home.pujariBlurb")}
            </AppText>
            <View style={{ gap: 8 }}>
              <PrimaryButton title={t("mobile.loginAsPujari")} variant="navy" onPress={() => router.push({ pathname: "/login", params: { role: "pujari" } })} />
              <PrimaryButton title={t("mobile.registerAsPujari")} variant="outline" onPress={() => router.push({ pathname: "/register", params: { role: "pujari" } })} />
            </View>
          </Card>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <AppText variant="eyebrow" color={colors.primary}>
            {t("home.offerings")}
          </AppText>
          <AppText variant="h2">{t("home.popularPujas")}</AppText>
          {popular.isLoading ? <LoadingBlock /> : null}
          {services.map((s: CatalogService) => (
            <Pressable key={s.id} onPress={() => router.push(`/service/${s.slug}`)}>
              <Card style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: colors.primary + "22", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="flame" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="h3">{s.name}</AppText>
                  <AppText variant="small" color={colors.mutedForeground} numberOfLines={2}>
                    {s.short_description || s.description || (s.standard_price_paise ? t("home.fromPrice", { price: rupees(s.standard_price_paise) }) : t("home.availableSoon"))}
                  </AppText>
                </View>
              </Card>
            </Pressable>
          ))}
          <PrimaryButton title={t("home.viewAllServices")} variant="outline" onPress={() => router.push("/browse-services")} />
        </View>

        <View style={{ padding: 20, gap: 8 }}>
          <AppText variant="h2">{t("home.feat1Title")}</AppText>
          <AppText color={colors.mutedForeground}>{t("home.feat1Desc")}</AppText>
          <AppText variant="h2" style={{ marginTop: 12 }}>
            {t("home.feat2Title")}
          </AppText>
          <AppText color={colors.mutedForeground}>{t("home.feat2Desc")}</AppText>
          <AppText variant="h2" style={{ marginTop: 12 }}>
            {t("home.feat3Title")}
          </AppText>
          <AppText color={colors.mutedForeground}>{t("home.feat3Desc")}</AppText>
        </View>
      </ScrollView>
    </View>
  );
}
