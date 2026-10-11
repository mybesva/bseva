import { Ionicons } from "@expo/vector-icons";
import { ImageBackground, StyleSheet, Text, View } from "react-native";
import { useI18n } from "@/providers/I18nProvider";

const HERO_ART = require("../../assets/welcome-pujari.jpg");

const NAVY = "#071A33";
const SAFFRON = "#FF7A00";
const GOLD = "#D4AF37";

/** Stacked bands → smooth navy fade from the text side into the photo (no gradient lib). */
const FADE = Array.from({ length: 30 }, () => 0.085);

export function pujariGreetingName(fullName: string | null | undefined, fallback: string) {
  const trimmed = String(fullName || "").trim();
  return trimmed || fallback;
}

/** Strip the 🙏 + name from "Namaste 🙏 {{name}}" so the name can be highlighted. */
function greetingParts(template: string, name: string) {
  const idx = template.indexOf(name);
  if (idx < 0) return { before: template, name: "", after: "" };
  return { before: template.slice(0, idx), name, after: template.slice(idx + name.length) };
}

/** Navy greeting card for the Pujari home (matches the customer home and web dashboards). */
export function PujariWelcomeHero({ pujariName }: { pujariName: string }) {
  const { t } = useI18n();
  const g = greetingParts(t("pujari.dashboard.namaste", { name: pujariName }), pujariName);
  const long = pujariName.trim().length > 14;

  return (
    <ImageBackground source={HERO_ART} style={styles.hero} imageStyle={styles.heroImage} resizeMode="cover">
      {FADE.map((alpha, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${36 + i * 1.3}%`,
            backgroundColor: `rgba(7,26,51,${alpha})`,
          }}
        />
      ))}
      <View style={styles.body}>
        <View style={styles.tagRow}>
          <Ionicons name="ribbon" size={12} color={SAFFRON} />
          <Text style={styles.tag}>{t("auth.pujari").toUpperCase()}</Text>
        </View>
        <Text style={[styles.greeting, long && { fontSize: 21, lineHeight: 27 }]}>
          {g.before}
          {g.name ? <Text style={{ color: "#FF9A2E" }}>{g.name}</Text> : null}
          {g.after}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {t("pujari.dashboard.subtitle")}
        </Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 24, overflow: "hidden", backgroundColor: NAVY, minHeight: 150, justifyContent: "center" },
  heroImage: { left: "35%" },
  body: { paddingHorizontal: 18, paddingVertical: 20, gap: 6, maxWidth: "78%" },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.55)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tag: { color: GOLD, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  greeting: { color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontWeight: "700", marginTop: 2 },
  subtitle: { color: "rgba(255,255,255,0.82)", fontSize: 13, lineHeight: 18 },
});
