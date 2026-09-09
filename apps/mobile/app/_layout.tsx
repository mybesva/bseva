import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProviders } from "@/providers/AppProviders";
import { useAppTheme } from "@/theme/ThemeContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function ThemedStack() {
  const { theme, colors } = useAppTheme();
  return (
    <>
      <StatusBar style={theme === "dark" ? "light" : "light"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProviders>
        <ThemedStack />
      </AppProviders>
    </GestureHandlerRootView>
  );
}
