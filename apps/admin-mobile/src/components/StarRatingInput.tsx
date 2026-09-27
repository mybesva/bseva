import { clampHeadRatingStars } from "@bseva/config";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/ui";
import { useAppTheme } from "@/theme/ThemeContext";

export function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (stars: number) => void;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const stars = clampHeadRatingStars(value);

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {Array.from({ length: 5 }, (_, i) => {
          const n = i + 1;
          const filled = n <= stars;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}
              accessibilityState={{ selected: filled }}
              disabled={disabled}
              onPress={() => onChange(n)}
              hitSlop={6}
              style={{ padding: 4, opacity: disabled ? 0.5 : 1 }}
            >
              <Ionicons
                name={filled ? "star" : "star-outline"}
                size={34}
                color={filled ? colors.primary : colors.mutedForeground}
              />
            </Pressable>
          );
        })}
      </View>
      <AppText variant="small" style={{ fontWeight: "600" }}>
        {stars} / 5
      </AppText>
    </View>
  );
}
