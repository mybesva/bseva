import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { AppText, PrimaryButton } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";

export type SelectOption = { id: string; label: string; subtitle?: string };

export function SelectField({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <View style={{ gap: 6 }}>
      <AppText variant="small">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        disabled={disabled || options.length === 0}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingVertical: 14,
          paddingHorizontal: 14,
          backgroundColor: colors.card,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <AppText style={{ flex: 1 }} numberOfLines={2}>
          {selected?.label || placeholder}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
      </Pressable>
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
            {options.map((o) => (
              <Pressable
                key={o.id}
                onPress={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 8,
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.border,
                  backgroundColor: value === o.id ? colors.secondary : "transparent",
                  borderRadius: 8,
                }}
              >
                <AppText variant={value === o.id ? "h3" : "body"}>{o.label}</AppText>
                {o.subtitle ? (
                  <AppText variant="small" color={colors.mutedForeground}>
                    {o.subtitle}
                  </AppText>
                ) : null}
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
