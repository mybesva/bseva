import { radius } from "@bseva/tokens";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { AppText } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

export type ProfileTabId = "profile" | "password" | "terms";

type ProfileTabBarProps = {
  value: ProfileTabId;
  onChange: (tab: ProfileTabId) => void;
};

const MIN_SEGMENTED_WIDTH = 320;

export function ProfileTabBar({ value, onChange }: ProfileTabBarProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const availableWidth = windowWidth - 32;
  const segmentedWidth = Math.max(availableWidth, MIN_SEGMENTED_WIDTH);
  const needsScroll = MIN_SEGMENTED_WIDTH > availableWidth;

  const tabs: {
    id: ProfileTabId;
    label: string;
    accessibilityLabel: string;
    lines: 1 | 2;
  }[] = [
    { id: "profile", label: t("profile.tab.profile"), accessibilityLabel: t("profile.tab.profile"), lines: 1 },
    {
      id: "password",
      label: t("profile.tab.changePasswordLines"),
      accessibilityLabel: t("profile.tab.changePassword"),
      lines: 2,
    },
    {
      id: "terms",
      label: t("profile.tab.termsLines"),
      accessibilityLabel: t("profile.tab.terms"),
      lines: 2,
    },
  ];

  const segmentedControl = (
    <View
      style={{
        flexDirection: "row",
        width: segmentedWidth,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        backgroundColor: colors.white,
        flexGrow: 0,
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.accessibilityLabel}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.id)}
            style={{
              flex: 1,
              minHeight: 44,
              paddingVertical: 8,
              paddingHorizontal: 4,
              backgroundColor: active ? colors.primary : colors.white,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AppText
              numberOfLines={tab.lines}
              style={{
                textAlign: "center",
                fontSize: 14,
                lineHeight: tab.lines === 2 ? 14 : 18,
                fontWeight: active ? "700" : "500",
              }}
              color={colors.navy}
            >
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexGrow: 0, flexShrink: 0 }}>
      {needsScroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }}>
          {segmentedControl}
        </ScrollView>
      ) : (
        segmentedControl
      )}
    </View>
  );
}
