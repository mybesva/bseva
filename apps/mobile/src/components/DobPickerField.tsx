import { Ionicons } from "@expo/vector-icons";
import { radius } from "@bseva/tokens";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { AppText, PrimaryButton } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { formatDisplayDate } from "@/utils/formatDate";

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Typed digits → "DD-MM-YYYY", adding the dashes as the user types (like the web date box). */
function maskDob(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
}

/** "DD-MM-YYYY" → "YYYY-MM-DD" when it is a real calendar date, else "". */
function typedToIso(text: string) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text);
  if (!m) return "";
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (d.getFullYear() !== Number(m[3]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[1])) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function yearsAgo(years: number) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

/** Date of birth: type DD-MM-YYYY (dashes added automatically) or pick from the calendar. Stores YYYY-MM-DD. */
export function DobPickerField({
  label,
  value,
  onChange,
  required,
  error,
  minAge = 18,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
  error?: string | null;
  minAge?: number;
}) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const maximumDate = yearsAgo(minAge);
  const minimumDate = yearsAgo(100);
  const iso = String(value || "").slice(0, 10);
  const current = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : yearsAgo(30);
  const [draft, setDraft] = useState(current);
  const [text, setText] = useState(iso ? formatDisplayDate(iso) : "");

  // A date chosen in the calendar (or loaded from the profile) replaces what was typed.
  useEffect(() => {
    if (iso && typedToIso(text) !== iso) setText(formatDisplayDate(iso));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);

  function onAndroidChange(event: DateTimePickerEvent, selected?: Date) {
    setOpen(false);
    if (event.type === "set" && selected) onChange(toIsoDate(selected));
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.mutedForeground, fontWeight: "600", fontSize: 13 }}>
        {label}
        {required ? <Text style={{ color: colors.destructive }}> *</Text> : null}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          minHeight: 48,
          paddingHorizontal: 12,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? colors.destructive : colors.border,
          backgroundColor: colors.input,
        }}
      >
        <TextInput
          accessibilityLabel={label}
          value={text}
          onChangeText={(raw) => {
            const masked = maskDob(raw);
            setText(masked);
            // Only a complete, real date is saved; anything partial counts as empty.
            onChange(typedToIso(masked));
          }}
          placeholder="DD-MM-YYYY"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
          maxLength={10}
          style={{ flex: 1, minHeight: 48, color: colors.foreground, fontSize: 16 }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("booking.selectDate")}
          hitSlop={8}
          onPress={() => {
            setDraft(current);
            setOpen(true);
          }}
        >
          <Ionicons name="calendar-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>
      {error ? <Text style={{ color: colors.destructive, fontSize: 13 }}>{error}</Text> : null}

      {Platform.OS === "android" && open ? (
        <DateTimePicker
          mode="date"
          display="spinner"
          value={current}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={onAndroidChange}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={() => setOpen(false)} />
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 28, gap: 12 }}>
              <AppText variant="h3">{label}</AppText>
              <DateTimePicker
                mode="date"
                display="spinner"
                value={draft}
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                onChange={(_e, selected) => selected && setDraft(selected)}
                textColor={colors.foreground}
              />
              <PrimaryButton
                title={t("common.done")}
                onPress={() => {
                  onChange(toIsoDate(draft));
                  setOpen(false);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
