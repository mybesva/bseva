import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/theme/ThemeContext";
import { AppText } from "./ui";

export function ScreenHeader({ title, back }: { title: ReactNode; back?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.navy }}>
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: colors.navy,
      }}
    >
      {back ? (
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.cream} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        {typeof title === "string" ? (
          <AppText variant="h3" color={colors.cream} numberOfLines={1}>
            {title}
          </AppText>
        ) : (
          title
        )}
      </View>
    </View>
    </SafeAreaView>
  );
}
