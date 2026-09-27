import { isAdminRole, isPujariRole } from "@bseva/config";
import type { CatalogService } from "@bseva/types";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, LoadingBlock, PrimaryButton } from "@/components/ui";
import { BrandLockup } from "@/components/BrandLockup";
import { PujaServiceCard } from "@/components/PujaImage";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { LanguagePicker } from "@/components/LanguagePicker";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

const HERO_ART = require("../assets/customer-hero-art.jpg");

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
      <View style={{ flex: 1, backgroundColor: colors.cream, justifyContent: "center" }}>
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
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} bounces={false}>
        <View style={heroStyles.shell}>
          <ImageBackground
            source={HERO_ART}
            style={heroStyles.bg}
            imageStyle={heroStyles.bgImage}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          >
            <View style={heroStyles.warmGlow} pointerEvents="none" />
            <SafeAreaView edges={["top"]} style={heroStyles.content}>
              <View style={heroStyles.logoWrap}>
                <BrandLockup height={208} />
              </View>

              <View style={heroStyles.badge}>
                <Ionicons name="flower-outline" size={13} color="#E07A2F" />
                <AppText variant="eyebrow" color={colors.navy} style={heroStyles.badgeText}>
                  {t("home.badge")}
                </AppText>
              </View>

              <AppText variant="display" color={colors.navy} style={heroStyles.heroTitle}>
                {t("home.heroTitle1")}
              </AppText>
              <AppText color="rgba(26,43,74,0.9)" style={heroStyles.heroDesc}>
                {t("home.heroDesc")}
              </AppText>

              <View style={heroStyles.searchRow}>
                <Ionicons
                  name="search"
                  size={18}
                  color={colors.mutedForeground}
                  style={{ marginLeft: 4 }}
                />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder={t("home.searchPujas")}
                  placeholderTextColor={colors.mutedForeground}
                  style={heroStyles.searchInput}
                  onSubmitEditing={() =>
                    router.push({ pathname: "/browse-services", params: { q } } as never)
                  }
                />
                <Pressable
                  onPress={() =>
                    router.push({ pathname: "/browse-services", params: { q } } as never)
                  }
                  style={heroStyles.searchButton}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.search")}
                >
                  <AppText variant="small" color={colors.primaryForeground} style={{ fontWeight: "700" }}>
                    {t("home.search")}
                  </AppText>
                </Pressable>
              </View>
            </SafeAreaView>
          </ImageBackground>
        </View>

        <View style={heroStyles.creamSection}>
          <LanguagePicker variant="landing" />
          <AppText variant="h2" style={{ marginTop: 8 }}>
            {t("home.choosePortal")}
          </AppText>
          <Card style={heroStyles.portalCard}>
            <Ionicons name="people" size={28} color={colors.primary} />
            <AppText variant="h3" style={{ marginTop: 8 }}>
              {t("auth.customer")}
            </AppText>
            <AppText variant="small" color={colors.mutedForeground} style={{ marginVertical: 8 }}>
              {t("home.customerBlurb")}
            </AppText>
            <View style={{ gap: 8 }}>
              <PrimaryButton
                title={t("mobile.loginAsCustomer")}
                onPress={() => router.push({ pathname: "/login", params: { role: "customer" } })}
              />
              <PrimaryButton
                title={t("mobile.registerAsCustomer")}
                variant="outline"
                onPress={() => router.push({ pathname: "/register", params: { role: "customer" } })}
              />
            </View>
          </Card>
          <Card style={heroStyles.portalCard}>
            <Ionicons name="flower" size={28} color={colors.navy} />
            <AppText variant="h3" style={{ marginTop: 8 }}>
              {t("auth.pujari")}
            </AppText>
            <AppText variant="small" color={colors.mutedForeground} style={{ marginVertical: 8 }}>
              {t("home.pujariBlurb")}
            </AppText>
            <View style={{ gap: 8 }}>
              <PrimaryButton
                title={t("mobile.loginAsPujari")}
                variant="navy"
                onPress={() => router.push({ pathname: "/login", params: { role: "pujari" } })}
              />
              <PrimaryButton
                title={t("mobile.registerAsPujari")}
                variant="outline"
                onPress={() => router.push({ pathname: "/register", params: { role: "pujari" } })}
              />
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
            <PujaServiceCard key={s.id} service={s} onPress={() => router.push(`/service/${s.slug}`)} />
          ))}
          <PrimaryButton
            title={t("home.viewAllServices")}
            variant="outline"
            onPress={() => router.push("/browse-services")}
          />
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

const heroStyles = StyleSheet.create({
  shell: {
    backgroundColor: "#FFF8E7",
    overflow: "hidden",
  },
  bg: {
    width: "100%",
  },
  bgImage: {
    resizeMode: "cover",
    width: "118%",
    height: "108%",
    transform: [{ translateX: -18 }, { translateY: -8 }],
  },
  warmGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,248,231,0.52)",
  },
  content: {
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  logoWrap: {
    alignSelf: "center",
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  badge: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,153,51,0.55)",
    backgroundColor: "rgba(255,255,255,0.42)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 18,
  },
  badgeText: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    marginBottom: 4,
  },
  heroDesc: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
  },
  searchRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(212,175,55,0.35)",
    shadowColor: "#1A2B4A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    color: "#1A2B4A",
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 44,
  },
  searchButton: {
    backgroundColor: "#FF9933",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  creamSection: {
    backgroundColor: "#FFF8E7",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 16,
  },
  portalCard: {
    borderColor: "rgba(212,175,55,0.35)",
    backgroundColor: "#FFFFFF",
  },
});
