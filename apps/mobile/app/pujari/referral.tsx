import * as Clipboard from "expo-clipboard";
import { useQuery } from "@tanstack/react-query";
import { Alert, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";

export default function PujariReferral() {
  const q = useQuery({
    queryKey: ["pujari-referral"],
    queryFn: () => apiClient.pujariReferral() as Promise<{ code?: string; referral_code?: string }>,
  });
  const code = q.data?.code || q.data?.referral_code || "";
  return (
    <Screen>
      <ScreenHeader title="Referral" back />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card>
          <AppText variant="small">Your referral code</AppText>
          <AppText variant="h1">{code || "—"}</AppText>
          <PrimaryButton
            title="Copy"
            variant="outline"
            onPress={async () => {
              if (!code) return;
              await Clipboard.setStringAsync(code);
              Alert.alert("Copied", code);
            }}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
