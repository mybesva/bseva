import { useRouter } from "expo-router";
import { View } from "react-native";
import { AppText, Card, PrimaryButton, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/providers/AuthProvider";

export default function AdminWebOnly() {
  const { logout } = useAuth();
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader title="Admin" />
      <View style={{ padding: 20 }}>
        <Card>
          <AppText variant="h2">Admin is web-only</AppText>
          <AppText style={{ marginVertical: 12 }}>
            BSeva operations run in the web admin console. Sign out here and use the website on a desktop browser.
          </AppText>
          <PrimaryButton
            title="Sign out"
            onPress={async () => {
              await logout();
              router.replace("/");
            }}
          />
        </Card>
      </View>
    </Screen>
  );
}
