import { ScreenHeader } from "@/components/ScreenHeader";
import { AboutScreenContent } from "@/components/AboutScreenContent";
import { Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";

export default function AboutScreen() {
  const { t } = useI18n();
  return (
    <Screen>
      <ScreenHeader title={t("mobile.about")} back />
      <AboutScreenContent />
    </Screen>
  );
}
