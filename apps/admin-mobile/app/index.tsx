import { isAdminRole } from "@bseva/config";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { useAppTheme } from "@/theme/ThemeContext";

export default function Index() {
  const { user, loading } = useAuth();
  const { colors } = useAppTheme();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.navy }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (user && isAdminRole(user.role)) return <Redirect href="/(app)" />;
  return <Redirect href="/login" />;
}
