import { ScreenHeader } from "@/components/ScreenHeader";
import { TermsScreenContent } from "@/components/TermsScreenContent";
import { Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";

export default function TermsScreen() {
  const { t } = useI18n();
  return (
    <Screen>
      <ScreenHeader title={t("legal.terms")} back />
      <TermsScreenContent />
    </Screen>
  );
}
