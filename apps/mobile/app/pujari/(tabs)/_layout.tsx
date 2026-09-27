import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

function TabIcon({
  name,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 4 }}>
      {focused ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            width: 28,
            height: 3,
            borderRadius: 2,
            backgroundColor: colors.primary,
          }}
        />
      ) : null}
      <Ionicons name={name} color={color} size={22} />
    </View>
  );
}

export default function PujariTabs() {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border + "66",
          borderTopWidth: 1,
          height: 56 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 4,
          elevation: 8,
          shadowColor: colors.navy,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
        },
        tabBarLabelStyle: { fontWeight: "600", fontSize: 10, marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("mobile.home"),
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "home" : "home-outline"} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: t("mobile.bookings"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "calendar" : "calendar-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t("nav.availability"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "calendar-clear" : "calendar-clear-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: t("mobile.earnings"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "wallet" : "wallet-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("mobile.more"),
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "menu" : "menu-outline"} color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
