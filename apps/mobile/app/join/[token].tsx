import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Linking, ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, ErrorBanner, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

export default function JoinMeet() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["meet", token],
    queryFn: () => apiClient.meetingInvite(token) as Promise<{ meeting_url?: string; title?: string; status?: string }>,
    enabled: !!token,
  });
  const url = q.data?.meeting_url;
  return (
    <Screen>
      <ScreenHeader title={t("mobile.joinMeet")} back />
      {q.isLoading ? <LoadingBlock /> : null}
      {q.error ? <ErrorBanner message={q.error instanceof Error ? q.error.message : "Invite not found"} /> : null}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <AppText variant="h2">{q.data?.title || "Virtual puja"}</AppText>
        {url ? (
          <PrimaryButton title={t("mobile.joinMeet")} onPress={() => void Linking.openURL(url)} />
        ) : (
          <View>
            <AppText>This invite is not ready yet. Open it again closer to the scheduled time.</AppText>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
