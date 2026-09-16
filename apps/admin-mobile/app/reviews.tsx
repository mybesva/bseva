import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";

export default function AdminReviews() {
  const { t } = useI18n();
  return (
    <Screen>
      <ScreenHeader title={t("admin.reviews")} back />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card>
          <AppText variant="h3">Reviews</AppText>
          <AppText>
            The web Admin Reviews page is a local demo (no backend API). Mobile matches that: live ratings are on each booking detail after a puja is completed.
          </AppText>
        </Card>
      </ScrollView>
    </Screen>
  );
}
