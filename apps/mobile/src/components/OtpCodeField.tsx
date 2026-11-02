import { Pressable, View } from "react-native";
import { AppText, Field } from "@/components/ui";
import { text } from "@/content/compliance";
import { useAppTheme } from "@/theme/ThemeContext";

/** 6-digit email code input with a resend link that waits out the cooldown. */
export function OtpCodeField({
  value,
  onChange,
  resendLeft,
  onResend,
  resending,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  resendLeft: number;
  onResend: () => void;
  resending?: boolean;
  error?: string | null;
}) {
  const { colors } = useAppTheme();
  const canResend = resendLeft <= 0 && !resending;
  return (
    <View style={{ gap: 8 }}>
      <Field
        label={text.code}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        error={error}
      />
      <Pressable
        accessibilityRole="button"
        disabled={!canResend}
        onPress={onResend}
        hitSlop={8}
        style={{ alignSelf: "flex-end", minHeight: 32, justifyContent: "center" }}
      >
        <AppText variant="small" color={canResend ? colors.primary : colors.mutedForeground} style={{ fontWeight: "700" }}>
          {resendLeft > 0 ? text.resendIn(resendLeft) : resending ? text.sending : text.resendCode}
        </AppText>
      </Pressable>
    </View>
  );
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function isSixDigitCode(v: string): boolean {
  return /^\d{6}$/.test(v.trim());
}
