import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

export default function AboutScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const values = [
    { title: t("about.v1"), desc: t("about.v1d") },
    { title: t("about.v2"), desc: t("about.v2d") },
    { title: t("about.v3"), desc: t("about.v3d") },
    { title: t("about.v4"), desc: t("about.v4d") },
  ];
  return (
    <Screen>
      <ScreenHeader title={t("mobile.about")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <AppText variant="eyebrow" color={colors.primary}>{t("about.badge")}</AppText>
        <AppText variant="h2">{t("about.title")}</AppText>
        <AppText color={colors.mutedForeground}>{t("about.heroDesc")}</AppText>
        <Card style={{ gap: 8 }}>
          <AppText variant="h3">{t("about.mission")}</AppText>
          <AppText color={colors.mutedForeground}>{t("about.missionP1")}</AppText>
          <AppText color={colors.mutedForeground}>{t("about.missionP2")}</AppText>
          {[t("about.point1"), t("about.point2"), t("about.point3"), t("about.point4")].map((item) => (
            <AppText key={item}>• {item}</AppText>
          ))}
        </Card>
        {values.map((v) => (
          <Card key={v.title} style={{ gap: 6 }}>
            <AppText variant="h3">{v.title}</AppText>
            <AppText variant="small" color={colors.mutedForeground}>{v.desc}</AppText>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
