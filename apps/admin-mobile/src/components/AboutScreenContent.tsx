import { ScrollView, View } from "react-native";
import { AboutEssenceCards } from "./AboutEssenceCards";
import { AppText, Card } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { spacing } from "@bseva/tokens";

function SectionDivider({ colors }: { colors: { border: string } }) {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.lg }} />;
}

export function AboutScreenContent() {
  const { t } = useI18n();
  const { colors } = useAppTheme();

  const values = [
    { title: t("about.v1"), desc: t("about.v1d") },
    { title: t("about.v2"), desc: t("about.v2d") },
    { title: t("about.v3"), desc: t("about.v3d") },
    { title: t("about.v4"), desc: t("about.v4d") },
    { title: t("about.v5"), desc: t("about.v5d") },
    { title: t("about.v6"), desc: t("about.v6d") },
  ];

  const stats = [
    { value: "500+", label: t("about.statPriests") },
    { value: "10k+", label: t("about.statPujas") },
    { value: "15+", label: t("about.statCities") },
    { value: "4.9", label: t("about.statRating") },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 48 }}>
      <AboutEssenceCards />

      <View style={{ gap: spacing.sm }}>
        <AppText variant="eyebrow" color={colors.primary}>
          {t("about.badge")}
        </AppText>
        <AppText variant="h2">{t("about.title")}</AppText>
        {t("about.heroDesc") ? (
          <AppText color={colors.foreground} style={{ lineHeight: 24 }}>
            {t("about.heroDesc")}
          </AppText>
        ) : null}
        {t("about.heroIntro") ? (
          <AppText color={colors.mutedForeground} style={{ lineHeight: 24 }}>
            {t("about.heroIntro")}
          </AppText>
        ) : null}
      </View>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="h3">{t("about.mission")}</AppText>
        <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
          {t("about.missionP1")}
        </AppText>
        <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
          {t("about.missionP2")}
        </AppText>
        <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
          {t("about.missionP3")}
        </AppText>
        <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
          {t("about.missionP4")}
        </AppText>
      </Card>

      <SectionDivider colors={colors} />

      <View style={{ gap: spacing.sm }}>
        <AppText variant="h3">{t("about.pujariCommitTitle")}</AppText>
        <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
          {t("about.pujariCommitP1")}
        </AppText>
        <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
          {t("about.pujariCommitP2")}
        </AppText>
        <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
          {t("about.pujariCommitP3")}
        </AppText>
        <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
          {t("about.pujariCommitP4")}
        </AppText>
        <Card
          style={{
            marginTop: spacing.sm,
            backgroundColor: `${colors.primary}10`,
            borderColor: `${colors.primary}40`,
          }}
        >
          <AppText color={colors.foreground} style={{ lineHeight: 22, fontWeight: "600", textAlign: "center" }}>
            {t("about.pujariCommitHighlight")}
          </AppText>
        </Card>
      </View>

      <SectionDivider colors={colors} />

      <View style={{ gap: spacing.sm }}>
        <AppText variant="h3">{t("about.valuesTitle")}</AppText>
        {t("about.valuesDesc") ? (
          <AppText variant="small" color={colors.mutedForeground}>
            {t("about.valuesDesc")}
          </AppText>
        ) : null}
        {values.map((v) => (
          <Card key={v.title} style={{ gap: 4 }}>
            <AppText variant="h3" style={{ fontSize: 16 }}>
              {v.title}
            </AppText>
            <AppText variant="small" color={colors.mutedForeground} style={{ lineHeight: 20 }}>
              {v.desc}
            </AppText>
          </Card>
        ))}
      </View>

      <SectionDivider colors={colors} />

      <View style={{ gap: spacing.sm }}>
        <AppText variant="h3">{t("about.onboardingTitle")}</AppText>
        <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
          {t("about.onboardingP1")}
        </AppText>
        <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
          {t("about.onboardingP2")}
        </AppText>
        <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
          {t("about.onboardingP3")}
        </AppText>
      </View>

      <SectionDivider colors={colors} />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
        {stats.map((stat) => (
          <View key={stat.label} style={{ width: "47%", alignItems: "center", gap: 4 }}>
            <AppText variant="h2" color={colors.primary}>
              {stat.value}
            </AppText>
            <AppText variant="small" color={colors.mutedForeground} style={{ textAlign: "center" }}>
              {stat.label}
            </AppText>
          </View>
        ))}
      </View>

      <SectionDivider colors={colors} />

      <AppText color={colors.mutedForeground} style={{ lineHeight: 24, textAlign: "center" }}>
        {t("about.combinedStatement")}
      </AppText>
    </ScrollView>
  );
}
