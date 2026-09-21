import { Ionicons } from "@expo/vector-icons";
import { ImageBackground, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { AppText } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

const HERO_ART = require("../../assets/customer-hero-art.jpg");

const TRUST: { key: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "customer.hero.trust.rituals", icon: "leaf-outline" },
  { key: "customer.hero.trust.pujaris", icon: "shield-checkmark-outline" },
  { key: "customer.hero.trust.services", icon: "people-outline" },
  { key: "customer.hero.trust.wellness", icon: "heart-outline" },
];

export function customerGreetingName(fullName: string | null | undefined, fallback: string) {
  const trimmed = String(fullName || "").trim();
  return trimmed || fallback;
}

function namasteParts(template: string) {
  const idx = template.indexOf("🙏");
  if (idx < 0) return { before: template, after: "" };
  return {
    before: template.slice(0, idx),
    after: template.slice(idx + "🙏".length).replace(/^\s+/, ""),
  };
}

export function CustomerWelcomeHero({
  customerName,
}: {
  customerName: string;
  publicId?: string | null;
}) {
  const { t } = useI18n();
  const { colors, theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const nameLen = customerName.trim().length;
  const headingSize = Math.min(
    compact ? 22 : 26,
    Math.max(
      15,
      Math.min(width * 0.072, 26) - Math.max(0, nameLen - 10) * (compact ? 0.48 : 0.38),
    ),
  );
  const greeting = namasteParts(t("customer.hero.namaste", { name: customerName }));
  const text = colors.foreground;
  const isDark = theme === "dark";
  const panelBg = isDark ? "rgba(21, 34, 56, 0.9)" : "rgba(255, 255, 255, 0.88)";

  return (
    <View style={[styles.shell, { backgroundColor: isDark ? "#0B1424" : "#FFF8E7" }]}>
      <ImageBackground source={HERO_ART} style={styles.bg} imageStyle={styles.bgImage} resizeMode="cover">
        <View style={[styles.overlay, { backgroundColor: isDark ? "rgba(11,20,36,0.72)" : "rgba(255,248,231,0.78)" }]} />
        <View style={styles.body}>
          <View style={styles.taglineRow}>
            <Ionicons name="flower-outline" size={14} color="#C45C2D" />
            <AppText color="#8B5A2B" style={styles.tagline}>
              {t("customer.hero.tagline")}
            </AppText>
          </View>

          <AppText
            variant="h2"
            color={text}
            style={[
              styles.heading,
              { fontSize: headingSize, lineHeight: Math.round(headingSize * 1.18) },
            ]}
          >
            {greeting.before}
            <Text style={{ fontSize: headingSize, lineHeight: Math.round(headingSize * 1.18), fontWeight: "700" }}>
              🙏{"\u00A0\u00A0"}
            </Text>
            {greeting.after}
          </AppText>
          <AppText
            variant="h3"
            color={text}
            style={[styles.welcome, compact ? { fontSize: 17, lineHeight: 22 } : null]}
          >
            {t("customer.hero.welcome")}
          </AppText>
          <AppText color={text} style={styles.blessing}>
            {t("customer.hero.blessing")}
          </AppText>
          <AppText color={colors.mutedForeground} style={styles.support}>
            {t("customer.hero.support")}
          </AppText>

          <View style={[styles.quote, { backgroundColor: panelBg }]}>
            <AppText color="#D4AF37" style={styles.quoteMark}>
              “
            </AppText>
            <View style={{ flex: 1 }}>
              <AppText color={text} style={styles.quoteText}>
                {t("customer.hero.quote")}
              </AppText>
              <AppText color="#C45C2D" style={styles.quoteBy}>
                — {t("customer.hero.quoteBy")}
              </AppText>
            </View>
          </View>

          <View style={[styles.trustPanel, { backgroundColor: panelBg }]}>
            {TRUST.map((item) => (
              <View key={item.key} style={styles.trustItem}>
                <Ionicons name={item.icon} size={18} color="#E07A2F" />
                <AppText color={text} style={styles.trustLabel}>
                  {t(item.key)}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 14,
    overflow: "hidden",
  },
  bg: {
    width: "100%",
  },
  bgImage: {
    resizeMode: "cover",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 6,
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 11,
    fontWeight: "500",
    flex: 1,
  },
  heading: {
    fontWeight: "700",
    width: "100%",
    maxWidth: "100%",
    flexShrink: 1,
    paddingRight: 28,
  },
  welcome: {
    fontWeight: "700",
    lineHeight: 24,
  },
  blessing: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  support: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  quote: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E6D2A8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 24,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  quoteMark: {
    fontSize: 28,
    lineHeight: 28,
    marginTop: -4,
  },
  quoteText: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
  },
  quoteBy: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  trustPanel: {
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  trustItem: {
    width: "50%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingRight: 6,
    minHeight: 40,
  },
  trustLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
});
