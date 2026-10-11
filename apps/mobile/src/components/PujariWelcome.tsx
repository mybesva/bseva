import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandLockup } from "@/components/BrandLockup";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useI18n } from "@/providers/I18nProvider";
import { useDarkStatusBarWhileFocused } from "@/hooks/useDarkStatusBarWhileFocused";

const HERO = require("../../assets/welcome-pujari.jpg");

/** B-Seva palette: warm cream base, saffron actions, gold accents, navy text. */
const SAFFRON = "#FF7A00";
const SAFFRON_DEEP = "#E86A00";
const GOLD = "#D4AF37";
const GOLD_DEEP = "#9C7A12";
const CREAM = "#FDF6EC";
const CREAM_2 = "#FFF1E2";
const GOLD_TINT = "#FBF3DC";
const INK = "#0E1830";
const MUTED = "#4A5770";
const LINE = "#EFE2CF";

const HERO_FADE = Array.from({ length: 36 }, () => 0.035);

/**
 * Pre-login welcome for the B-Seva Pujari app. Two self-explanatory paths:
 * existing Pujaris sign in, new Pujaris register (with the 3 onboarding steps spelled out).
 * Uses the same /login and /register flows as before.
 */
export function PujariWelcome() {
  const { t } = useI18n();
  const router = useRouter();
  useDarkStatusBarWhileFocused();
  const goLogin = () => router.push({ pathname: "/login", params: { role: "pujari" } });
  const goRegister = () => router.push({ pathname: "/register", params: { role: "pujari" } });

  const steps = [t("mw.pjStep1"), t("mw.pjStep2"), t("mw.pjStep3")];
  const perks = [
    { icon: "people-outline" as const, label: t("lp.aud.p1") },
    { icon: "calendar-outline" as const, label: t("lp.aud.p2") },
    { icon: "time-outline" as const, label: t("lp.aud.p3") },
    { icon: "person-outline" as const, label: t("lp.aud.p4") },
    { icon: "trending-up-outline" as const, label: t("lp.aud.p5") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: CREAM }}>
      <SafeAreaView edges={["top"]} style={s.topSafe}>
        <View style={s.topBar}>
          <BrandLockup variant="compact" height={46} />
          <View style={s.appTag}>
            <Ionicons name="ribbon" size={13} color="#FFFFFF" />
            <Text style={s.appTagText}>{t("auth.pujari").toUpperCase()}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Hero card */}
        <View style={s.heroWrap}>
          <ImageBackground source={HERO} style={s.hero} imageStyle={{ borderRadius: 28 }} resizeMode="cover" accessibilityIgnoresInvertColors>
            {HERO_FADE.map((alpha, i) => (
              <View
                key={i}
                pointerEvents="none"
                style={[s.fadeBand, { height: `${8 + i * 1.9}%`, backgroundColor: `rgba(14,8,0,${alpha})` }]}
              />
            ))}
            <View style={s.heroChip}>
              <Ionicons name="shield-checkmark" size={13} color={SAFFRON} />
              <Text style={s.heroChipText}>{t("lp.aud.pEyebrow")}</Text>
            </View>
            <View style={{ padding: 20, gap: 8 }}>
              <Text style={s.heroTitle}>{t("mw.pujariHeroTitle")}</Text>
              <Text style={s.heroDesc} numberOfLines={3}>
                {t("auth.pujariLoginDescription")}
              </Text>
            </View>
          </ImageBackground>
        </View>

        {/* ── Card 1: existing Pujari → login (highlighted) ── */}
        <View style={s.section}>
          <View style={[s.card, s.loginCard]}>
            <View style={s.cardHead}>
              <View style={[s.cardIcon, { backgroundColor: CREAM_2 }]}>
                <Ionicons name="log-in-outline" size={26} color={SAFFRON_DEEP} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{t("mw.pjLoginTitle")}</Text>
                <Text style={s.cardDesc}>{t("mw.pjLoginDesc")}</Text>
              </View>
            </View>
            <Pressable
              onPress={goLogin}
              accessibilityRole="button"
              accessibilityLabel={t("mw.pujariSub")}
              style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]}
            >
              <Ionicons name="ribbon-outline" size={20} color="#FFFFFF" />
              <Text style={s.primaryBtnText}>{t("mw.pujariSub")}</Text>
              <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* ── Card 2: new Pujari → register, with the steps explained ── */}
        <View style={s.section}>
          <View style={[s.card, s.joinCard]}>
            <View style={s.cardHead}>
              <View style={[s.cardIcon, { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(212,175,55,0.6)" }]}>
                <Ionicons name="person-add-outline" size={24} color={GOLD_DEEP} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{t("mw.pjNewTitle")}</Text>
                <Text style={s.cardDesc}>{t("mw.pjNewDesc")}</Text>
              </View>
            </View>
            <View style={{ gap: 10, marginTop: 2 }}>
              {steps.map((step, i) => (
                <View key={step} style={s.stepRow}>
                  <View style={s.stepNum}>
                    <Text style={s.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={s.stepText}>{step}</Text>
                </View>
              ))}
            </View>
            <Pressable
              onPress={goRegister}
              accessibilityRole="button"
              accessibilityLabel={t("mobile.registerAsPujari")}
              style={({ pressed }) => [s.secondaryBtn, pressed && s.pressed]}
            >
              <Text style={s.secondaryBtnText}>{t("mobile.registerAsPujari")}</Text>
              <Ionicons name="arrow-forward" size={18} color={SAFFRON_DEEP} />
            </Pressable>
          </View>
        </View>

        {/* What you can do */}
        <View style={s.section}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <View style={{ width: 18, height: 2, backgroundColor: SAFFRON }} />
            <Text style={s.eyebrow}>{t("mw.pjWhat").toUpperCase()}</Text>
          </View>
          <View style={s.perkGrid}>
            {perks.map((p) => (
              <View key={p.label} style={s.perk}>
                <View style={s.perkIcon}>
                  <Ionicons name={p.icon} size={18} color={SAFFRON} />
                </View>
                <Text style={s.perkText}>{p.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recognition */}
        <View style={s.section}>
          <View style={s.recognition}>
            <Ionicons name="star" size={22} color={GOLD} />
            <Text style={s.cardTitle}>{t("home.feat3Title")}</Text>
            <Text style={s.cardDesc}>{t("home.feat3Desc")}</Text>
          </View>
        </View>

        <View style={s.section}>
          <LanguagePicker variant="landing" />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  topSafe: { backgroundColor: CREAM, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 6 },
  appTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  appTagText: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "800", letterSpacing: 1.4 },

  heroWrap: { paddingHorizontal: 16, paddingTop: 14 },
  hero: { height: 340, borderRadius: 28, overflow: "hidden", justifyContent: "space-between" },
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
  },
  heroChipText: { color: INK, fontSize: 11.5, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { color: "#FFFFFF", fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.3, textShadowColor: "rgba(0,0,0,0.55)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 },
  heroDesc: { color: "rgba(255,255,255,0.92)", fontSize: 14, lineHeight: 20, fontWeight: "500", textShadowColor: "rgba(0,0,0,0.55)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 },

  section: { paddingHorizontal: 16, paddingTop: 18 },
  card: { borderRadius: 24, padding: 18, gap: 14 },
  loginCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: SAFFRON,
    shadowColor: SAFFRON,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  joinCard: { backgroundColor: GOLD_TINT, borderWidth: 1.5, borderColor: "rgba(212,175,55,0.55)" },
  cardHead: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  cardIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: INK, fontSize: 19, lineHeight: 24, fontWeight: "800" },
  cardDesc: { color: MUTED, fontSize: 13.5, lineHeight: 19, fontWeight: "500", marginTop: 4 },
  primaryBtn: {
    height: 58,
    borderRadius: 18,
    backgroundColor: SAFFRON,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 2,
    borderColor: "#FFB25E",
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { color: GOLD_DEEP, fontSize: 14, fontWeight: "800" },
  stepText: { flex: 1, color: INK, fontSize: 14.5, fontWeight: "700", lineHeight: 19 },
  secondaryBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: SAFFRON,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: { color: SAFFRON_DEEP, fontSize: 16, fontWeight: "800" },

  eyebrow: { color: SAFFRON_DEEP, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, flexShrink: 1 },
  perkGrid: { gap: 8 },
  perk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  perkIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: CREAM_2, alignItems: "center", justifyContent: "center" },
  perkText: { flex: 1, color: INK, fontSize: 14, fontWeight: "700" },
  recognition: { backgroundColor: "#FFFFFF", borderRadius: 22, borderWidth: 1.5, borderColor: "rgba(212,175,55,0.5)", padding: 18, gap: 8 },
});
