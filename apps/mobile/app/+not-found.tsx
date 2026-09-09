import { useRouter } from "expo-router";
import { View } from "react-native";
import { AppText, PrimaryButton, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader title="BSeva" />
      <View style={{ padding: 24, gap: 12 }}>
        <AppText variant="h2">Page not found</AppText>
        <AppText>This screen is not available in the BSeva app.</AppText>
        <PrimaryButton title="Go to home" onPress={() => router.replace("/")} />
      </View>
    </Screen>
  );
}
