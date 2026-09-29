import { useLocalSearchParams } from "expo-router";
import { PujaDiscovery } from "@/components/customer/PujaDiscovery";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";

/** Public Puja browse screen (landing search). Shares the Puja Seva discovery component. */
export default function BrowseServices() {
  const { q, slug } = useLocalSearchParams<{ q?: string; slug?: string }>();
  const { t } = useI18n();

  return (
    <Screen>
      <ScreenHeader title={t("services.title")} back />
      <PujaDiscovery initialQuery={q || ""} slug={slug || undefined} />
    </Screen>
  );
}
