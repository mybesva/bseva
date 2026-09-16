import { isAdminRole } from "@bseva/config";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

export default function AdminTabs() {
  const { user, loading } = useAuth();
  const { colors } = useAppTheme();
  const { t } = useI18n();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!user || !isAdminRole(user.role)) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.gold },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t("admin.dashboard"), tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: t("admin.bookings"), tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="pujaris"
        options={{ title: t("admin.pujaris"), tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: t("mobile.more"), tabBarIcon: ({ color, size }) => <Ionicons name="menu" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
