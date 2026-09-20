import { Ionicons } from "@expo/vector-icons";
import { bookingLeadHint, isCalendarDayDisabled } from "@bseva/config";
import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { DateCalendar } from "@/components/DateCalendar";
import { AppText, Field, PrimaryButton } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { formatDisplayDate, parseDisplayDateToIso } from "@/utils/formatDate";

export function DatePickerField({
  value,
  onChange,
  leadHours = 48,
  label,
  hint,
}: {
  value: string;
  onChange: (iso: string) => void;
  leadHours?: number;
  label?: string;
  hint?: string;
}) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(() => formatDisplayDate(value));
  const [manualError, setManualError] = useState<string | null>(null);
  const title = label || t("booking.selectDate");

  useEffect(() => {
    setManual(formatDisplayDate(value));
  }, [value]);

  function commitManual(raw: string) {
    setManual(raw);
    const iso = parseDisplayDateToIso(raw);
    if (!iso) {
      if (/^\d{2}-\d{2}-\d{4}$/.test(raw.trim())) setManualError(t("booking.needDate"));
      else setManualError(null);
      return;
    }
    const d = new Date(`${iso}T12:00:00`);
    if (isCalendarDayDisabled(d, leadHours)) {
      setManualError(hint || bookingLeadHint(leadHours));
      return;
    }
    setManualError(null);
    onChange(iso);
  }

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
          borderWidth: 1,
          borderColor: colors.border,
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
      <Field
        label="DD-MM-YYYY"
        value={manual}
        onChangeText={(raw) => {
          const cleaned = raw.replace(/[^\d-]/g, "").slice(0, 10);
          commitManual(cleaned);
        }}
        placeholder="DD-MM-YYYY"
        keyboardType="numbers-and-punctuation"
      />
      {manualError ? <AppText variant="small" color={colors.destructive}>{manualError}</AppText> : null}
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
                setManual(formatDisplayDate(iso));
                setManualError(null);
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
