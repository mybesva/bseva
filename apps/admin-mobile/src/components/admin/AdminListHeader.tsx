import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "@/components/ui";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

export function AdminListHeader({
  title,
  back,
  onAdd,
  addLabel = "Add",
  showAdd = true,
  right,
}: {
  title: string;
  back?: boolean;
  onAdd?: () => void;
  addLabel?: string;
  showAdd?: boolean;
  right?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.background }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 48,
        }}
      >
        {back ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("mobile.back")}
            style={{ minWidth: 36, minHeight: 36, justifyContent: "center" }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.navy} />
          </Pressable>
        ) : null}
        <AppText variant="h2" style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </AppText>
        {right}
        {showAdd && onAdd ? (
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={addLabel}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="add" size={18} color={colors.primaryForeground} />
            <AppText variant="small" color={colors.primaryForeground} style={{ fontWeight: "700" }}>
              {addLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
