import { useRouter } from "expo-router";
import { View } from "react-native";
import { AppText, PrimaryButton, Screen } from "@/components/ui";

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <View style={{ padding: 24, gap: 12 }}>
        <AppText variant="h2">Screen not found</AppText>
        <PrimaryButton title="Admin home" onPress={() => router.replace("/(app)")} />
      </View>
    </Screen>
  );
}
