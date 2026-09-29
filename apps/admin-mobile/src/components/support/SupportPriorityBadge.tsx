import { displayTokenLabel } from "@bseva/config";
import { StyleSheet, Text, View } from "react-native";
import { radius } from "@bseva/tokens";
import { PRIORITY_LABELS } from "@/lib/supportLabels";
import { useAppTheme } from "@/theme/ThemeContext";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#dc2626",
  high: "#ea580c",
  medium: "#2563eb",
  low: "#64748b",
};

export function SupportPriorityBadge({ priority }: { priority: string }) {
  const { colors } = useAppTheme();
  const key = String(priority || "medium").toLowerCase();
  const color = PRIORITY_COLORS[key] || colors.mutedForeground;
  const label = PRIORITY_LABELS[key] || displayTokenLabel(key, "");

  return (
    <View
      style={{
        backgroundColor: color + "18",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radius.pill,
        alignSelf: "flex-start",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: color + "33",
      }}
    >
      <Text style={{ color, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </Text>
    </View>
  );
}
