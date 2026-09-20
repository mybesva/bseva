import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { Field } from "@/components/ui";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseHm(value: string): { h: number; m: number } {
  const [hs, ms] = (value || "10:00").split(":");
  const h = Math.min(23, Math.max(0, Number(hs) || 0));
  const m = Math.min(59, Math.max(0, Number(ms) || 0));
  return { h, m };
}

function hmToDate(h: number, m: number) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToHm(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Web-like time: one typable field; tap clock or field opens native picker when available. */
export function TimePicker({ value, onChange }: { value: string; onChange: (hhmm: string) => void }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const display = (value || "10:00").slice(0, 5);
  const { h, m } = parseHm(display);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  function commitHm(raw: string) {
    const cleaned = raw.replace(/[^\d:]/g, "").slice(0, 5);
    if (/^\d{2}:\d{2}$/.test(cleaned)) {
      const parsed = parseHm(cleaned);
      onChange(`${pad(parsed.h)}:${pad(parsed.m)}`);
    } else {
      onChange(cleaned);
    }
  }

  function onNativeChange(_event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") setShowAndroidPicker(false);
    if (selected) onChange(dateToHm(selected));
  }

  const timeLabel = t("web.booking.time") === "web.booking.time" ? "Time" : t("web.booking.time");

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            if (Platform.OS === "android") setShowAndroidPicker(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={timeLabel}
        >
          <Field
            label={timeLabel}
            value={display}
            onChangeText={commitHm}
            keyboardType="numbers-and-punctuation"
            placeholder="10:00"
          />
        </Pressable>
        {Platform.OS === "android" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={timeLabel}
            onPress={() => setShowAndroidPicker(true)}
            style={{
              marginBottom: 4,
              minWidth: 48,
              minHeight: 48,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.card,
            }}
          >
            <Ionicons name="time-outline" size={22} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      {Platform.OS === "ios" ? (
        <DateTimePicker mode="time" display="compact" value={hmToDate(h, m)} onChange={onNativeChange} />
      ) : null}
      {Platform.OS === "android" && showAndroidPicker ? (
        <DateTimePicker mode="time" display="default" is24Hour value={hmToDate(h, m)} onChange={onNativeChange} />
      ) : null}
    </View>
  );
}
