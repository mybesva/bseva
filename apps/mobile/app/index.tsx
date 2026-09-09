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
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function LandingScreen() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [q, setQ] = useState("");

  const popular = useQuery({
    queryKey: ["services", "featured"],
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
                  placeholder="Search Pujas, Homams, Vrathams..."
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
                    Search
                  </AppText>
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </ImageBackground>

        <View style={{ padding: 20, gap: 16 }}>
          <AppText variant="h2">{t("portal.customer.title").includes("Customer") ? "Choose your BSeva portal" : "Get started"}</AppText>
          <Card>
            <Ionicons name="people" size={28} color={colors.primary} />
            <AppText variant="h3" style={{ marginTop: 8 }}>
              {t("auth.customer") === "auth.customer" ? "Customer" : t("auth.customer")}
            </AppText>
            <AppText variant="small" color={colors.mutedForeground} style={{ marginVertical: 8 }}>
              Book pujas, manage wallet, and track bookings.
            </AppText>
            <View style={{ gap: 8 }}>
              <PrimaryButton title="Login as Customer" onPress={() => router.push({ pathname: "/login", params: { role: "customer" } })} />
              <PrimaryButton title="Register as Customer" variant="outline" onPress={() => router.push({ pathname: "/register", params: { role: "customer" } })} />
            </View>
          </Card>
          <Card>
            <Ionicons name="flower" size={28} color={colors.primary} />
            <AppText variant="h3" style={{ marginTop: 8 }}>
              Pujari
            </AppText>
            <AppText variant="small" color={colors.mutedForeground} style={{ marginVertical: 8 }}>
              Complete your profile, upload documents, and receive bookings.
            </AppText>
            <View style={{ gap: 8 }}>
              <PrimaryButton title="Login as Pujari" variant="navy" onPress={() => router.push({ pathname: "/login", params: { role: "pujari" } })} />
              <PrimaryButton title="Register as Pujari" variant="outline" onPress={() => router.push({ pathname: "/register", params: { role: "pujari" } })} />
            </View>
          </Card>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <AppText variant="eyebrow" color={colors.primary}>
            {t("home.offerings")}
          </AppText>
          <AppText variant="h2">Popular Pujas</AppText>
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
                    {s.short_description || s.description || (s.standard_price_paise ? `From ${rupees(s.standard_price_paise)}` : "Available soon")}
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
