import { useRouter } from "expo-router";
import { View } from "react-native";
import { AppText, Card, PrimaryButton, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/providers/AuthProvider";

export default function AdminUseAdminApp() {
  const { logout } = useAuth();
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader title="Admin" />
      <View style={{ padding: 20 }}>
        <Card>
          <AppText variant="h2">Use the BSeva Admin app</AppText>
          <AppText style={{ marginVertical: 12 }}>
            Admin and Super Admin operations run in the separate BSeva Admin mobile app (com.bseva.admin) or the web admin console. This Customer + Pujari app will not expose admin tools.
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
