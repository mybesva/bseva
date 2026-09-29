import type { SevaServiceType } from "@bseva/config";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/ui";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

const LABEL_KEYS: Record<SevaServiceType, "seva.puja" | "seva.chadhava" | "seva.pravachan"> = {
  puja: "seva.puja",
  chadhava: "seva.chadhava",
  pravachan: "seva.pravachan",
};

/** Explore Services top-level tabs: Puja Seva | Chadhava Seva | Pravachan Seva. */
export function SevaTypeTabs({
  value,
  types,
  onChange,
}: {
  value: SevaServiceType;
  types: readonly SevaServiceType[];
  onChange: (type: SevaServiceType) => void;
}) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: "row", gap: 6, backgroundColor: colors.secondary, borderRadius: 12, padding: 4 }}
    >
      {types.map((type) => {
        const selected = type === value;
        return (
          <Pressable
            key={type}
            onPress={() => onChange(type)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={t(LABEL_KEYS[type])}
            style={{
              flex: 1,
              minHeight: 40,
              paddingHorizontal: 6,
              paddingVertical: 8,
              borderRadius: 9,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: selected ? colors.primary : "transparent",
            }}
          >
            <AppText
              numberOfLines={2}
              color={selected ? colors.primaryForeground : colors.foreground}
              style={{ fontWeight: "700", fontSize: 12, textAlign: "center" }}
            >
              {t(LABEL_KEYS[type])}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
