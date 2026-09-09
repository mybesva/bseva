import { radius, spacing, typography } from "@bseva/tokens";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useAppTheme } from "@/theme/ThemeContext";

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useAppTheme();
  return <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>{children}</View>;
}

export function AppText({
  children,
  variant = "body",
  color,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: keyof typeof typography;
  color?: string;
  style?: object;
  numberOfLines?: number;
}) {
  const { colors } = useAppTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color: color || colors.foreground, ...typography[variant] }, style]}
    >
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
}: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "outline" | "ghost" | "navy";
}) {
  const { colors } = useAppTheme();
  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "navy"
        ? colors.navy
        : "transparent";
  const fg =
    variant === "outline" || variant === "ghost" ? colors.primary : variant === "navy" ? colors.cream : colors.primaryForeground;
  const border = variant === "outline" ? colors.primary : "transparent";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: radius.md,
        borderWidth: variant === "outline" ? 1.5 : 0,
        borderColor: border,
        paddingVertical: 14,
        paddingHorizontal: 16,
        alignItems: "center",
        opacity: disabled || loading ? 0.55 : pressed ? 0.85 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontWeight: "700", fontSize: 15 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.mutedForeground, fontWeight: "600", fontSize: 13 }}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        style={{
          backgroundColor: colors.input,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 12,
          paddingVertical: 12,
          color: colors.foreground,
          fontSize: 16,
        }}
        {...props}
      />
    </View>
  );
}

export function ChoiceChips({
  options,
  value,
  onChange,
  multiple,
}: {
  options: { id: string; label: string }[];
  value: string | string[];
  onChange: (next: string | string[]) => void;
  multiple?: boolean;
}) {
  const { colors } = useAppTheme();
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const on = selected.has(opt.id);
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              if (multiple) {
                const next = new Set(selected);
                if (next.has(opt.id)) next.delete(opt.id);
                else next.add(opt.id);
                onChange(Array.from(next));
              } else {
                onChange(opt.id);
              }
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: on ? colors.primary : colors.secondary,
            }}
          >
            <Text style={{ color: on ? colors.primaryForeground : colors.foreground, fontWeight: "600", fontSize: 13 }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { colors } = useAppTheme();
  const map: Record<string, string> = {
    confirmed: colors.success,
    completed: colors.mutedForeground,
    pending: colors.warning,
    pending_acceptance: colors.warning,
    in_progress: colors.info,
    cancelled: colors.destructive,
    rejected: colors.destructive,
  };
  const color = map[status] || colors.mutedForeground;
  return (
    <View style={{ backgroundColor: color + "22", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill }}>
      <Text style={{ color, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
        {status.replace(/_/g, " ")}
      </Text>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ paddingVertical: 40, alignItems: "center", gap: 8 }}>
      <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>{subtitle}</Text> : null}
    </View>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  const { colors } = useAppTheme();
  if (!message) return null;
  return (
    <View style={{ backgroundColor: colors.destructive + "18", padding: 12, borderRadius: radius.md }}>
      <Text style={{ color: colors.destructive }}>{message}</Text>
    </View>
  );
}

export function LoadingBlock() {
  const { colors } = useAppTheme();
  return (
    <View style={{ padding: 32, alignItems: "center" }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
