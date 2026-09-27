import { Ionicons } from "@expo/vector-icons";
import { ImageBackground, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { AppText } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

const HERO_ART = require("../../assets/customer-hero-art.jpg");

function namasteParts(template: string) {
  const idx = template.indexOf("🙏");
  if (idx < 0) return { before: template, after: "" };
  return {
    before: template.slice(0, idx),
    after: template.slice(idx + "🙏".length).replace(/^\s+/, ""),
  };
}

export function pujariGreetingName(fullName: string | null | undefined, fallback: string) {
  const trimmed = String(fullName || "").trim();
  return trimmed || fallback;
}

export function PujariWelcomeHero({ pujariName }: { pujariName: string }) {
  const { t } = useI18n();
  const { colors, theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const nameLen = pujariName.trim().length;
  const headingSize = Math.min(
    compact ? 20 : 22,
    Math.max(16, Math.min(width * 0.058, 22) - Math.max(0, nameLen - 12) * (compact ? 0.4 : 0.32)),
  );
  const greeting = namasteParts(t("pujari.dashboard.namaste", { name: pujariName }));
  const isDark = theme === "dark";

  return (
    <View style={[styles.shell, { backgroundColor: isDark ? "#0B1424" : "#FFF8E7" }]}>
      <ImageBackground source={HERO_ART} style={styles.bg} imageStyle={styles.bgImage} resizeMode="cover">
        <View
          style={[
            styles.overlay,
            { backgroundColor: isDark ? "rgba(11,20,36,0.78)" : "rgba(255,248,231,0.82)" },
          ]}
        />
        <View style={styles.body}>
          <View style={styles.namasteRow}>
            <Text style={{ fontSize: headingSize * 0.95 }}>🙏</Text>
            <AppText
              variant="h2"
              color={colors.navy}
              style={[
                styles.heading,
                { fontSize: headingSize, lineHeight: Math.round(headingSize * 1.2) },
              ]}
            >
              {greeting.before}
              {greeting.after}
            </AppText>
          </View>
          <AppText color={colors.mutedForeground} style={styles.subtitle} numberOfLines={2}>
            {t("pujari.dashboard.subtitle")}
          </AppText>
          <View style={styles.templeAccent} pointerEvents="none">
            <Ionicons name="business-outline" size={56} color={colors.primary + "22"} />
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
    minHeight: 96,
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
    gap: 4,
    minHeight: 96,
    justifyContent: "center",
  },
  namasteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingRight: 48,
  },
  heading: {
    fontWeight: "700",
    flex: 1,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    maxWidth: "88%",
  },
  templeAccent: {
    position: "absolute",
    right: 8,
    bottom: 6,
    opacity: 0.9,
  },
});
