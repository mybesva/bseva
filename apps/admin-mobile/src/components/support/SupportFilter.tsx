import { Pressable, ScrollView } from "react-native";
import { AppText } from "@/components/ui";
import { FILTER_OPTIONS } from "@/lib/supportLabels";
import { useAppTheme } from "@/theme/ThemeContext";

export function SupportFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { colors } = useAppTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {FILTER_OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <Pressable
            key={opt.id || "all"}
            onPress={() => onChange(opt.id)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: active ? colors.primary : colors.card,
              borderWidth: active ? 0 : 1,
              borderColor: colors.border,
              minHeight: 36,
              justifyContent: "center",
            }}
          >
            <AppText
              variant="small"
              style={{ fontWeight: "700", color: active ? colors.primaryForeground : colors.foreground }}
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
