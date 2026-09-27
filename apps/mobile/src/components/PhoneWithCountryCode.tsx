import { PHONE_COUNTRY_CODES } from "@bseva/config";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { AppText, PrimaryButton } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { radius } from "@bseva/tokens";

function nationalMaxLen(countryCode: string): number {
  return countryCode === "+91" ? 10 : 12;
}

export function PhoneWithCountryCode({
  label,
  required,
  countryCode,
  national,
  onCountryCodeChange,
  onNationalChange,
  error,
  disabled,
}: {
  label: string;
  required?: boolean;
  countryCode: string;
  national: string;
  onCountryCodeChange: (code: string) => void;
  onNationalChange: (digits: string) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const max = nationalMaxLen(countryCode);

  return (
    <View style={{ gap: 6 }}>
      <AppText variant="small">
        {label}
        {required ? <AppText style={{ color: colors.destructive }}> *</AppText> : null}
      </AppText>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("auth.phone")}
          disabled={disabled}
          onPress={() => setOpen(true)}
          style={{
            width: 88,
            minHeight: 48,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            borderWidth: 1,
            borderColor: error ? colors.destructive : colors.border,
            borderRadius: radius.md,
            backgroundColor: colors.input,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <AppText style={{ fontWeight: "700", fontSize: 16 }}>{countryCode}</AppText>
          <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
        </Pressable>
        <TextInput
          accessibilityLabel={label}
          editable={!disabled}
          value={national}
          onChangeText={(v) => onNationalChange(v.replace(/\D/g, "").slice(0, max))}
          keyboardType="phone-pad"
          placeholder={countryCode === "+91" ? "10-digit mobile" : "Phone number"}
          placeholderTextColor={colors.mutedForeground}
          autoComplete="tel-national"
          style={{
            flex: 1,
            minHeight: 48,
            backgroundColor: colors.input,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error ? colors.destructive : colors.border,
            paddingHorizontal: 12,
            paddingVertical: 12,
            color: colors.foreground,
            fontSize: 16,
          }}
        />
      </View>
      {error ? <AppText style={{ color: colors.destructive, fontSize: 13 }}>{error}</AppText> : null}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={() => setOpen(false)} />
          <View
            style={{
              maxHeight: "55%",
              backgroundColor: colors.background,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
              paddingBottom: 24,
              gap: 8,
            }}
          >
            <AppText variant="h3">{label}</AppText>
            <ScrollView keyboardShouldPersistTaps="handled">
              {PHONE_COUNTRY_CODES.map((c) => (
                <Pressable
                  key={c.code}
                  onPress={() => {
                    onCountryCodeChange(c.code);
                    setOpen(false);
                  }}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 8,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                    backgroundColor: countryCode === c.code ? colors.secondary : "transparent",
                    borderRadius: 8,
                  }}
                >
                  <AppText variant={countryCode === c.code ? "h3" : "body"}>{c.label}</AppText>
                </Pressable>
              ))}
            </ScrollView>
            <PrimaryButton title={t("common.close")} variant="outline" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
