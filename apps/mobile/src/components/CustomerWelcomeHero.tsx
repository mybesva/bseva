import { Ionicons } from "@expo/vector-icons";
import { ImageBackground, StyleSheet, Text, View } from "react-native";
import { AppText } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

const HERO_ART = require("../../assets/customer-home-temple.jpg");

const NAVY = "#071A33";
const SAFFRON = "#FF7A00";
const GOLD = "#D4AF37";

/** Stacked layer opacities, widest first, so the overlap builds a smooth fade toward the left edge. */
const FADE = [0.16, 0.14, 0.13, 0.12, 0.11, 0.1, 0.1, 0.1];

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

/** Splits "Namaste 🙏 {{name}}!" around the name so it can be highlighted in any language. */
function greetingParts(template: string, name: string) {
  const idx = template.indexOf(name);
  if (idx < 0) return { before: template, name: "", after: "" };
  return { before: template.slice(0, idx), name, after: template.slice(idx + name.length) };
}

/** Navy greeting card for the customer home (matches the web dashboard hero). */
export function CustomerWelcomeHero({
  customerName,
}: {
  customerName: string;
  publicId?: string | null;
}) {
  const { t } = useI18n();
  const { colors, theme } = useAppTheme();
  const isDark = theme === "dark";
  const g = greetingParts(t("customer.hero.namaste", { name: customerName }), customerName);
  const long = customerName.trim().length > 14;

  return (
    <View style={styles.shell}>
      <ImageBackground source={HERO_ART} style={styles.hero} imageStyle={styles.heroImage} resizeMode="cover">
        <View style={styles.shade} />
        {/* Left-to-right navy fade (no gradient lib needed): solid at the text, clear over the temple. */}
        {FADE.map((alpha, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: `${100 - i * 9}%`,
              backgroundColor: `rgba(7,26,51,${alpha})`,
            }}
          />
        ))}
        <View style={styles.body}>
          <View style={styles.taglineRow}>
            <Ionicons name="flower-outline" size={13} color={SAFFRON} />
            <Text style={styles.tagline} numberOfLines={1}>
              {t("customer.hero.tagline").toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.greeting, long && { fontSize: 22, lineHeight: 28 }]}>
            {g.before}
            {g.name ? <Text style={{ color: SAFFRON }}>{g.name}</Text> : null}
            {g.after}
          </Text>
          <Text style={styles.blessing}>
            {t("customer.hero.welcome")} {t("customer.hero.blessing")}
          </Text>
          <Text style={styles.quote}>
            “{t("customer.hero.quote")}” — {t("customer.hero.quoteBy")}
          </Text>
        </View>
      </ImageBackground>

      <View style={styles.trustGrid}>
        {TRUST.map(({ key, icon }) => (
          <View
            key={key}
            style={[styles.trustItem, { backgroundColor: colors.card, borderColor: isDark ? colors.border : "#E6D2A8" }]}
          >
            <View style={[styles.trustIcon, isDark && { backgroundColor: "rgba(255,122,0,0.15)" }]}>
              <Ionicons name={icon} size={16} color={SAFFRON} />
            </View>
            <AppText variant="small" style={{ flex: 1, fontWeight: "700" }} numberOfLines={2}>
              {t(key)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: 10 },
  hero: { borderRadius: 24, overflow: "hidden", backgroundColor: NAVY },
  heroImage: { opacity: 0.95 },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7,26,51,0.18)",
  },
  body: { paddingHorizontal: 18, paddingVertical: 20, gap: 6 },
  taglineRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tagline: { color: SAFFRON, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, flexShrink: 1 },
  greeting: { color: "#FFFFFF", fontSize: 26, lineHeight: 32, fontWeight: "700", marginTop: 2 },
  blessing: { color: "rgba(255,255,255,0.88)", fontSize: 13, lineHeight: 19, fontWeight: "500", maxWidth: 300 },
  quote: { color: GOLD, fontSize: 11.5, lineHeight: 16, fontWeight: "700", marginTop: 6 },
  trustGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  trustItem: {
    flexBasis: "48%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E6D2A8",
    backgroundColor: "#FFFFFF",
  },
  trustIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#FFF1E2",
    alignItems: "center",
    justifyContent: "center",
  },
});
