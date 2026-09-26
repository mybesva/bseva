import { ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { isAdminRole } from "@bseva/config";

function roleLabel(role: string | undefined) {
  if (role === "super_admin") return "Super Admin";
  if (isAdminRole(role)) return "Admin";
  return role || "Admin";
}

export default function AdminProfile() {
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <Screen>
      <ScreenHeader title={t("mobile.profile")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card style={{ gap: 8 }}>
          <AppText variant="h2">{user?.name || t("mobile.profile")}</AppText>
          <AppText>{roleLabel(user?.role)}</AppText>
          {user?.email ? <AppText variant="small">{user.email}</AppText> : null}
          {user?.phone ? <AppText variant="small">{user.phone}</AppText> : null}
        </Card>
        <View>
          <AppText variant="small">
            Account details for the signed-in admin. Application configuration lives under Settings.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}
