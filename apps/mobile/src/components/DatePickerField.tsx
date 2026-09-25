import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { DateCalendar } from "@/components/DateCalendar";
import { AppText, PrimaryButton } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { formatDisplayDate } from "@/utils/formatDate";

export function DatePickerField({
  value,
  onChange,
  leadHours = 48,
  label,
  hint,
  error,
}: {
  value: string;
  onChange: (iso: string) => void;
  leadHours?: number;
  label?: string;
  hint?: string;
  error?: string | null;
}) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const title = label || t("booking.selectDate");

  return (
    <View style={{ gap: 6 }}>
      <AppText variant="small">{title}</AppText>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderWidth: error ? 2 : 1,
          borderColor: error ? colors.destructive || "#B42318" : colors.border,
          borderRadius: 10,
          paddingVertical: 14,
          paddingHorizontal: 14,
          backgroundColor: colors.card,
        }}
      >
        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
        <AppText style={{ flex: 1 }}>{value ? formatDisplayDate(value) : t("booking.selectDate")}</AppText>
        <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
      </Pressable>
      {error ? <AppText variant="small" color={colors.destructive || "#B42318"}>{error}</AppText> : null}
      {hint ? <AppText variant="small" color={colors.mutedForeground}>{hint}</AppText> : null}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={() => setOpen(false)} />
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
              paddingBottom: 28,
              gap: 12,
            }}
          >
            <AppText variant="h3">{title}</AppText>
            <DateCalendar
              value={value}
              leadHours={leadHours}
              showSelectedFooter={false}
              onChange={(iso) => {
                onChange(iso);
                setOpen(false);
              }}
            />
            <PrimaryButton title={t("common.close")} variant="outline" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
