import { useRouter } from "expo-router";
import { View } from "react-native";
import { AppText, PrimaryButton, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useI18n } from "@/providers/I18nProvider";

export default function NotFound() {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <Screen>
      <ScreenHeader title={t("app.name")} />
      <View style={{ padding: 24, gap: 12 }}>
        <AppText variant="h2">{t("common.notFound")}</AppText>
        <AppText>{t("common.notFoundDesc")}</AppText>
        <PrimaryButton title={t("common.goHome")} onPress={() => router.replace("/")} />
      </View>
    </Screen>
  );
}
