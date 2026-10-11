import { isAdminRole, isPujariRole, pujaServicesOnly, rupees } from "@bseva/config";
import type { CatalogService } from "@bseva/types";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandLockup } from "@/components/BrandLockup";
import { LanguagePicker } from "@/components/LanguagePicker";
import { PujaImage } from "@/components/PujaImage";
import { PujariWelcome } from "@/components/PujariWelcome";
import { AppText, LoadingBlock } from "@/components/ui";
import { isCustomerApp, isPujariApp, roleAllowedInApp } from "@/config/appVariant";
import { useAuth } from "@/providers/AuthProvider";
import { useDarkStatusBarWhileFocused } from "@/hooks/useDarkStatusBarWhileFocused";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

const HERO = require("../assets/welcome-hero.jpg");
const PUJARI = require("../assets/welcome-pujari.jpg");

/** B-Seva palette: warm cream base, saffron action colour, gold accents, navy text. */
const SAFFRON = "#FF7A00";
const SAFFRON_DEEP = "#E86A00";
const GOLD = "#D4AF37";
const CREAM = "#FDF6EC";
const CREAM_2 = "#FFF1E2";
const INK = "#0E1830";
const MUTED = "#4A5770";
const LINE = "#EFE2CF";

/** Stacked translucent bands → smooth dark fade at the bottom of the hero photo (no gradient lib). */
const HERO_FADE = Array.from({ length: 36 }, () => 0.035);

export default function LandingScreen() {
  const { user, loading, logout } = useAuth();
  const { t, lang } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [q, setQ] = useState("");
  useDarkStatusBarWhileFocused();

  const popular = useQuery({
    queryKey: ["services", "featured", lang],
    queryFn: () => apiClient.listServices({ featured: 1 }),
    enabled: !isPujariApp,
  });

  const wrongApp = Boolean(user && !roleAllowedInApp(user.role));
  useEffect(() => {
    // A stored session for the other app's role: sign out and show this app's welcome.
    if (wrongApp) void logout();
  }, [wrongApp, logout]);

  if (loading || wrongApp) {
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

  if (isPujariApp) return <PujariWelcome />;

  const services = pujaServicesOnly(popular.data).slice(0, 8);
  const goLogin = (role: "customer" | "pujari") => router.push({ pathname: "/login", params: { role } });
  const goRegister = () => router.push({ pathname: "/register", params: { role: "customer" } });
  const search = () => router.push({ pathname: "/browse-services", params: { q } } as never);

  const steps = [
    { title: t("lp.how.s1t"), desc: t("lp.how.s1d"), icon: "search-outline" as const },
    { title: t("lp.how.s2t"), desc: t("lp.how.s2d"), icon: "calendar-outline" as const },
    { title: t("lp.how.s3t"), desc: t("lp.how.s3d"), icon: "shield-checkmark-outline" as const },
    { title: t("lp.how.s4t"), desc: t("lp.how.s4d"), icon: "flame-outline" as const },
  ];
  const benefits = [
    { title: t("lp.app.f1t"), desc: t("lp.app.f1d"), icon: "flash-outline" as const },
    { title: t("lp.app.f2t"), desc: t("lp.app.f2d"), icon: "lock-closed-outline" as const },
    { title: t("lp.app.f3t"), desc: t("lp.app.f3d"), icon: "calendar-outline" as const },
    { title: t("lp.app.f4t"), desc: t("lp.app.f4d"), icon: "language-outline" as const },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: CREAM }}>
      {/* Fixed brand bar */}
      <SafeAreaView edges={["top"]} style={s.topSafe}>
        <View style={s.topBar}>
          <BrandLockup variant="compact" height={46} />
          <Pressable onPress={() => goLogin("customer")} style={s.signInPill} accessibilityRole="button" hitSlop={6}>
            <Ionicons name="person-circle-outline" size={18} color={SAFFRON_DEEP} />
            <Text style={s.signInText}>{t("auth.signIn")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* ───────── Hero card ───────── */}
        <View style={s.heroWrap}>
          <ImageBackground
            source={HERO}
            style={s.hero}
            imageStyle={{ borderRadius: 28 }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          >
            {HERO_FADE.map((alpha, i) => (
              <View
                key={i}
                pointerEvents="none"
                style={[s.fadeBand, { height: `${8 + i * 1.9}%`, backgroundColor: `rgba(14,8,0,${alpha})` }]}
              />
            ))}
            <View style={s.heroChip}>
              <Ionicons name="flower" size={12} color={SAFFRON} />
              <Text style={s.heroChipText} numberOfLines={1}>
                {t("lp.trust.pujaris")} · {t("lp.trust.details")}
              </Text>
            </View>
            <View style={s.heroBody}>
              <Text style={s.heroTitle}>
                {t("lp.hero.title1")} <Text style={{ color: "#FFB547" }}>{t("lp.hero.title2")}</Text> {t("lp.hero.title3")}
              </Text>
            </View>
          </ImageBackground>
        </View>

        {/* ───────── Primary action ───────── */}
        <View style={s.ctaBlock}>
          <Text style={s.lead}>{t("lp.hero.desc")}</Text>
          <Pressable
            onPress={() => goLogin("customer")}
            accessibilityRole="button"
            accessibilityLabel={t("mw.bookPuja")}
            style={({ pressed }) => [s.bookBtn, pressed && s.pressed]}
          >
            <View style={s.bookIcon}>
              <Ionicons name="flower-outline" size={24} color={SAFFRON} />
            </View>
            <Text style={s.bookText}>{t("mw.bookPuja")}</Text>
            <View style={s.bookArrow}>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </View>
          </Pressable>
          <Text style={s.bookHint}>{t("mw.bookPujaHint")}</Text>
          <Pressable onPress={goRegister} hitSlop={8} accessibilityRole="link" style={{ alignSelf: "center" }}>
            <Text style={s.registerLink}>{t("mw.newAccount")}</Text>
          </Pressable>
          {!isCustomerApp ? (
            <Pressable onPress={() => goLogin("pujari")} hitSlop={8} accessibilityRole="link" style={s.pujariLink}>
              <Ionicons name="ribbon-outline" size={15} color={MUTED} />
              <Text style={s.pujariLinkText}>{t("mw.areYouPujari")}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* ───────── Search ───────── */}
        <View style={s.section}>
          <View style={s.searchRow}>
            <Ionicons name="search" size={18} color={MUTED} style={{ marginLeft: 8 }} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t("home.searchPujas")}
              placeholderTextColor="#8A93A6"
              style={s.searchInput}
              returnKeyType="search"
              onSubmitEditing={search}
            />
            <Pressable onPress={search} style={s.searchBtn} accessibilityRole="button" accessibilityLabel={t("home.search")}>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* ───────── Trust strip ───────── */}
        <View style={s.section}>
          <View style={s.statCard}>
            {[
              { n: "7", label: t("lp.impact.languages") },
              { n: "3", label: t("lp.impact.sevaTypes") },
              { n: "17", label: t("lp.impact.timezones") },
            ].map((x, i) => (
              <View key={x.label} style={[s.stat, i > 0 && s.statDivider]}>
                <Text style={s.statNum}>{x.n}</Text>
                <Text style={s.statLabel} numberOfLines={3}>
                  {x.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ───────── Featured pujas ───────── */}
        <View style={s.section}>
          <SectionTitle eyebrow={t("home.offerings")} title={t("home.popularPujas")} />
          {popular.isLoading ? <LoadingBlock /> : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 20 }}
            style={{ marginHorizontal: -20, paddingLeft: 20 }}
          >
            {services.map((svc: CatalogService) => (
              <Pressable
                key={svc.id}
                onPress={() => router.push(`/service/${svc.slug}`)}
                style={({ pressed }) => [s.pujaCard, pressed && s.pressed]}
                accessibilityRole="button"
                accessibilityLabel={svc.name}
              >
                <PujaImage
                  service={svc}
                  height={120}
                  style={{ borderRadius: 0, aspectRatio: undefined, height: 120 }}
                  imageStyle={{ borderRadius: 0, resizeMode: "cover" }}
                />
                <View style={{ padding: 12, gap: 4 }}>
                  <Text style={s.pujaName} numberOfLines={2}>
                    {svc.name}
                  </Text>
                  {svc.standard_price_paise != null ? (
                    <Text style={s.pujaPrice}>
                      {t("customer.from")} {rupees(svc.standard_price_paise)}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={() => router.push("/browse-services")} style={s.outlineBtn} accessibilityRole="button">
            <Text style={s.outlineBtnText}>{t("home.viewAllServices")}</Text>
            <Ionicons name="arrow-forward" size={16} color={SAFFRON_DEEP} />
          </Pressable>
        </View>

        {/* ───────── How it works ───────── */}
        <View style={s.section}>
          <SectionTitle eyebrow={t("lp.how.eyebrow")} title={t("lp.how.title")} />
          <View style={s.stepsCard}>
            {steps.map((step, i) => (
              <View key={step.title} style={s.stepRow}>
                <View style={{ alignItems: "center" }}>
                  <View style={s.stepNum}>
                    <Text style={s.stepNumText}>{i + 1}</Text>
                  </View>
                  {i < steps.length - 1 ? <View style={s.stepLine} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: i < steps.length - 1 ? 16 : 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <Ionicons name={step.icon} size={15} color={SAFFRON} />
                    <Text style={s.stepTitle}>{step.title}</Text>
                  </View>
                  <Text style={s.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ───────── Verified Pujaris ───────── */}
        <View style={s.section}>
          <View style={s.pujariCard}>
            <Image source={PUJARI} style={s.pujariImg} resizeMode="cover" accessibilityLabel={t("lp.aud.pImgAlt")} />
            <View style={s.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#FFFFFF" />
              <Text style={s.verifiedBadgeText}>{t("customer.hero.trust.pujaris")}</Text>
            </View>
            <View style={{ padding: 18, gap: 10 }}>
              {[t("lp.how.s3d"), t("lp.aud.c3"), t("lp.aud.c5")].map((line) => (
                <View key={line} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                  <View style={s.tick}>
                    <Ionicons name="checkmark" size={13} color={SAFFRON} />
                  </View>
                  <Text style={[s.body, { flex: 1 }]}>{line}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ───────── Benefits ───────── */}
        <View style={s.section}>
          <SectionTitle eyebrow={t("lp.app.eyebrow")} title={t("mw.whyTitle")} />
          <View style={s.benefitGrid}>
            {benefits.map((b) => (
              <View key={b.title} style={s.benefit}>
                <View style={s.benefitIcon}>
                  <Ionicons name={b.icon} size={20} color={SAFFRON} />
                </View>
                <Text style={s.benefitTitle}>{b.title}</Text>
                <Text style={s.benefitDesc}>{b.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <LanguagePicker variant="landing" />
        </View>

        {/* ───────── Closing CTA ───────── */}
        <View style={s.section}>
          <View style={s.finalCard}>
            <Text style={s.finalTitle}>{t("lp.final.title")}</Text>
            <Text style={s.finalDesc}>{t("lp.final.desc")}</Text>
            <Pressable
              onPress={() => goLogin("customer")}
              style={({ pressed }) => [s.finalBtn, pressed && s.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="flower-outline" size={19} color={SAFFRON_DEEP} />
              <Text style={s.finalBtnText}>{t("mw.bookPuja")}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={{ gap: 6, marginBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 18, height: 2, backgroundColor: SAFFRON }} />
        <Text style={{ color: SAFFRON_DEEP, fontSize: 11, fontWeight: "800", letterSpacing: 1.6 }}>{eyebrow.toUpperCase()}</Text>
      </View>
      <AppText variant="h2" color={INK} style={{ fontSize: 22, lineHeight: 28 }}>
        {title}
      </AppText>
    </View>
  );
}

const s = StyleSheet.create({
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  topSafe: { backgroundColor: CREAM, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 6 },
  signInPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255,122,0,0.45)",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  signInText: { color: SAFFRON_DEEP, fontSize: 14, fontWeight: "800" },

  heroWrap: { paddingHorizontal: 16, paddingTop: 14 },
  hero: { height: 380, borderRadius: 28, overflow: "hidden", justifyContent: "space-between" },
  fadeBand: { position: "absolute", left: 0, right: 0, bottom: 0 },
  heroChip: {
    alignSelf: "flex-start",
    margin: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,253,250,0.94)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: "90%",
  },
  heroChipText: { color: INK, fontSize: 12, fontWeight: "800" },
  heroBody: { padding: 20 },
  heroTitle: { color: "#FFFFFF", fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.3, textShadowColor: "rgba(0,0,0,0.55)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 },

  ctaBlock: { paddingHorizontal: 20, paddingTop: 18, gap: 12 },
  lead: { color: MUTED, fontSize: 15, lineHeight: 22, fontWeight: "500", textAlign: "center" },
  bookBtn: {
    height: 68,
    borderRadius: 22,
    backgroundColor: SAFFRON,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    marginTop: 4,
    shadowColor: SAFFRON,
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    borderWidth: 2,
    borderColor: "#FFB25E",
  },
  bookIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  bookText: { flex: 1, textAlign: "center", color: "#FFFFFF", fontSize: 21, fontWeight: "800", letterSpacing: 0.2 },
  bookArrow: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(0,0,0,0.14)", alignItems: "center", justifyContent: "center" },
  bookHint: { color: MUTED, fontSize: 13, textAlign: "center", fontWeight: "600" },
  registerLink: { color: SAFFRON_DEEP, fontSize: 14.5, fontWeight: "800", textDecorationLine: "underline" },
  pujariLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 },
  pujariLinkText: { color: MUTED, fontSize: 13, fontWeight: "700" },

  section: { paddingHorizontal: 20, paddingTop: 28 },
  searchRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    gap: 6,
  },
  searchInput: { flex: 1, color: INK, fontSize: 15, minHeight: 44, paddingVertical: 8 },
  searchBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: SAFFRON, alignItems: "center", justifyContent: "center" },

  statCard: { flexDirection: "row", backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: LINE, paddingVertical: 14 },
  stat: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: LINE },
  statNum: { color: SAFFRON, fontSize: 28, fontWeight: "800", lineHeight: 32 },
  statLabel: { color: INK, fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 4, lineHeight: 14 },

  pujaCard: { width: 190, backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: LINE },
  pujaName: { color: INK, fontSize: 14.5, fontWeight: "800", lineHeight: 19 },
  pujaPrice: { color: SAFFRON_DEEP, fontSize: 12.5, fontWeight: "800" },
  outlineBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: SAFFRON,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  outlineBtnText: { color: SAFFRON_DEEP, fontWeight: "800", fontSize: 14.5 },

  stepsCard: { backgroundColor: "#FFFFFF", borderRadius: 22, borderWidth: 1, borderColor: LINE, padding: 18 },
  stepRow: { flexDirection: "row", gap: 14 },
  stepNum: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CREAM_2,
    borderWidth: 2,
    borderColor: SAFFRON,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { color: SAFFRON_DEEP, fontSize: 16, fontWeight: "800" },
  stepLine: { flex: 1, width: 2, backgroundColor: "rgba(212,175,55,0.55)", marginVertical: 4 },
  stepTitle: { color: INK, fontSize: 15.5, fontWeight: "800" },
  stepDesc: { color: MUTED, fontSize: 13.5, lineHeight: 19, marginTop: 3 },

  pujariCard: { backgroundColor: "#FFFFFF", borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: LINE },
  pujariImg: { width: "100%", height: 200 },
  verifiedBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1B7A4A",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  verifiedBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  body: { color: MUTED, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  tick: { width: 22, height: 22, borderRadius: 11, backgroundColor: CREAM_2, alignItems: "center", justifyContent: "center", marginTop: 1 },

  benefitGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  benefit: { flexBasis: "48%", flexGrow: 1, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: LINE, padding: 14, gap: 6 },
  benefitIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: CREAM_2, alignItems: "center", justifyContent: "center" },
  benefitTitle: { color: INK, fontSize: 14.5, fontWeight: "800", marginTop: 4 },
  benefitDesc: { color: MUTED, fontSize: 12.5, lineHeight: 17 },

  finalCard: { backgroundColor: SAFFRON, borderRadius: 24, padding: 22, gap: 10, borderWidth: 2, borderColor: GOLD },
  finalTitle: { color: "#FFFFFF", fontSize: 22, lineHeight: 28, fontWeight: "800" },
  finalDesc: { color: "rgba(255,255,255,0.92)", fontSize: 14, lineHeight: 20, marginBottom: 6 },
  finalBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  finalBtnText: { color: SAFFRON_DEEP, fontSize: 17, fontWeight: "800" },
});
