import { displayTokenLabel } from "@bseva/config";
import { StyleSheet, Text, View } from "react-native";
import { radius } from "@bseva/tokens";
import { STATUS_LABELS } from "@/lib/supportLabels";
import { useAppTheme } from "@/theme/ThemeContext";

const STATUS_COLORS: Record<string, string> = {
  open: "#0284c7",
  in_progress: "#d97706",
  waiting_for_user: "#7c3aed",
  escalated: "#dc2626",
  resolved: "#059669",
  closed: "#64748b",
};

export function SupportStatusBadge({ status }: { status: string }) {
  const { colors } = useAppTheme();
  const key = String(status || "open").toLowerCase();
  const color = STATUS_COLORS[key] || colors.mutedForeground;
  const label = STATUS_LABELS[key] || displayTokenLabel(key, "");

  return (
    <View
      style={{
        backgroundColor: color + "22",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radius.pill,
        alignSelf: "flex-start",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: color + "44",
      }}
    >
      <Text
        style={{ color, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
