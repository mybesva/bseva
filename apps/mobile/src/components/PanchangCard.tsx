import {
  DEFAULT_PANCHANG_CALENDAR,
  addDaysToIsoDate,
  formatPanchangDateSubtitle,
  formatPanchangSelectedDate,
  isTodayIsoDate,
  panchangApiCalendarParam,
  todayIsoDate,
  type PanchangCalendarType,
} from "@bseva/config";
import type { PanchangData } from "@bseva/types";
import { radius, spacing } from "@bseva/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Modal, Pressable, View, type ViewStyle } from "react-native";
import { DateCalendar } from "@/components/DateCalendar";
import { AppText, LoadingBlock, PrimaryButton } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

const TODAY_ACTIVE_TEXT = "#10203D";
const TODAY_ORANGE = "#FF8A2A";
const TODAY_INACTIVE_BORDER = "rgba(255, 138, 42, 0.35)";

const NAV_SIZE = 44;
const OUTER_PAD = 16;
const SECTION_GAP = 16;
const CARD_GAP = 12;
const FIELD_MIN_H = 88;

function cleanLabel(text: string): string {
  return text.replace(/:\s*$/, "").trim();
}

function calendarTypeLabel(t: (key: string) => string, key: string, shortKey: string): string {
  const translated = t(key);
  if (translated !== key) return translated;
  const short = t(shortKey);
  return short !== shortKey ? short : key;
}

function CalendarTypeToggle({
  value,
  onChange,
}: {
  value: PanchangCalendarType;
  onChange: (next: PanchangCalendarType) => void;
}) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const options: { id: PanchangCalendarType; label: string }[] = [
    { id: "solar", label: calendarTypeLabel(t, "calendar.solarCalendar", "calendar.solar") },
    { id: "lunar", label: calendarTypeLabel(t, "calendar.lunarCalendar", "calendar.lunar") },
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        backgroundColor: colors.white,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.id)}
            style={{
              flex: 1,
              minHeight: 44,
              paddingVertical: 8,
              paddingHorizontal: 6,
              backgroundColor: active ? colors.primary : colors.white,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AppText
              numberOfLines={2}
              style={{
                textAlign: "center",
                fontSize: 12,
                lineHeight: 16,
                fontWeight: active ? "700" : "500",
              }}
              color={active ? colors.navy : colors.navy}
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function NavIconButton({
  onPress,
  label,
  icon,
}: {
  onPress: () => void;
  label: string;
  icon: "chevron-back" | "chevron-forward";
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: NAV_SIZE,
        height: NAV_SIZE,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.white,
      }}
    >
      <Ionicons name={icon} size={20} color={colors.navy} />
    </Pressable>
  );
}

function PanchangField({
  label,
  value,
  highlight,
  style,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        {
          flex: 1,
          minHeight: FIELD_MIN_H,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: highlight ? colors.primary : `${colors.border}99`,
          backgroundColor: highlight ? `${colors.primary}14` : colors.white,
          padding: OUTER_PAD,
          justifyContent: "center",
          gap: 6,
        },
        style,
      ]}
    >
      <AppText
        variant="small"
        color={highlight ? colors.primary : colors.mutedForeground}
        style={{ fontWeight: "600", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}
      >
        {label}
      </AppText>
      <AppText
        style={{ fontSize: 15, lineHeight: 20, fontWeight: "700" }}
        color={colors.navy}
      >
        {value}
      </AppText>
    </View>
  );
}

export function PanchangCard() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const [selectedDate, setSelectedDate] = useState(() => todayIsoDate());
  const [calendarType, setCalendarType] = useState<PanchangCalendarType>(DEFAULT_PANCHANG_CALENDAR);
  const [pickerOpen, setPickerOpen] = useState(false);

  const panchang = useQuery({
    queryKey: ["panchang", selectedDate, calendarType],
    queryFn: () =>
      apiClient.panchang(selectedDate, panchangApiCalendarParam(calendarType)) as Promise<PanchangData>,
  });

  const data = panchang.data;
  const dateLabel = formatPanchangSelectedDate(calendarType, selectedDate, data);
  const dateSubtitle = formatPanchangDateSubtitle(calendarType, selectedDate, data);
  const onToday = isTodayIsoDate(selectedDate);

  const tithiValue = data
    ? `${data.tithi}${data.paksha ? ` (${data.paksha})` : ""}`
    : "—";
  const lunarMonthValue = data
    ? `${data.lunarMonth}${data.lunarDay ? ` · ${t("calendar.lunarDay", { day: data.lunarDay })}` : ""}`
    : "—";

  return (
    <View
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: `${colors.border}CC`,
        backgroundColor: colors.cream,
        padding: OUTER_PAD,
        gap: SECTION_GAP,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingBottom: 2 }}>
        <Ionicons name="calendar-outline" size={22} color={colors.primary} />
        <AppText style={{ fontSize: 23, lineHeight: 28, fontWeight: "700" }} color={colors.navy}>
          {t("calendar.panchangam")}
        </AppText>
      </View>

      {/* Segmented control */}
      <CalendarTypeToggle value={calendarType} onChange={setCalendarType} />

      {/* Date navigation — single row, no wrap */}
      <View style={{ gap: CARD_GAP }}>
        <View style={{ flexDirection: "row", alignItems: "stretch", gap: CARD_GAP }}>
          <NavIconButton
            label={t("calendar.previousDay")}
            icon="chevron-back"
            onPress={() => setSelectedDate((d) => addDaysToIsoDate(d, -1))}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setPickerOpen(true)}
            style={{
              flex: 1,
              minHeight: NAV_SIZE,
              borderWidth: 1,
              borderColor: `${colors.border}99`,
              borderRadius: radius.md,
              paddingVertical: 10,
              paddingHorizontal: 12,
              backgroundColor: colors.white,
              justifyContent: "center",
              gap: 4,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText
                  style={{ fontSize: 14, lineHeight: 18, fontWeight: "600" }}
                  color={colors.navy}
                  numberOfLines={2}
                >
                  {dateLabel}
                </AppText>
                {dateSubtitle && !panchang.isLoading ? (
                  <AppText
                    variant="small"
                    color={colors.mutedForeground}
                    style={{ marginTop: 2, fontSize: 12, lineHeight: 16 }}
                    numberOfLines={1}
                  >
                    {dateSubtitle}
                  </AppText>
                ) : null}
              </View>
            </View>
          </Pressable>
          <NavIconButton
            label={t("calendar.nextDay")}
            icon="chevron-forward"
            onPress={() => setSelectedDate((d) => addDaysToIsoDate(d, 1))}
          />
        </View>

        {/* Today — always centered below nav on mobile */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: onToday }}
          disabled={onToday}
          onPress={() => setSelectedDate(todayIsoDate())}
          style={{
            alignSelf: "center",
            minHeight: 36,
            paddingHorizontal: 20,
            paddingVertical: 8,
            borderRadius: radius.md,
            borderWidth: onToday ? 3 : 1,
            borderColor: onToday ? TODAY_ORANGE : TODAY_INACTIVE_BORDER,
            backgroundColor: "#FFFFFF",
          }}
        >
          <AppText
            style={{ fontSize: 14, fontWeight: onToday ? "700" : "600" }}
            color={onToday ? TODAY_ACTIVE_TEXT : colors.primary}
          >
            {t("calendar.today")}
          </AppText>
        </Pressable>
      </View>

      {/* Information cards — 2×2 */}
      {panchang.isLoading ? (
        <LoadingBlock />
      ) : data ? (
        <View style={{ gap: CARD_GAP }}>
          <View style={{ flexDirection: "row", gap: CARD_GAP, alignItems: "stretch" }}>
            <PanchangField label={cleanLabel(t("calendar.tithi"))} value={tithiValue} />
            <PanchangField label={cleanLabel(t("calendar.nakshatra"))} value={data.nakshatra} />
          </View>
          <View style={{ flexDirection: "row", gap: CARD_GAP, alignItems: "stretch" }}>
            <PanchangField label={cleanLabel(t("calendar.lunarMonth"))} value={lunarMonthValue} />
            <PanchangField label={cleanLabel(t("calendar.rahuKalam"))} value={data.rahukaalam} highlight />
          </View>
        </View>
      ) : (
        <PrimaryButton title={t("common.retry")} variant="outline" onPress={() => void panchang.refetch()} />
      )}

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={() => setPickerOpen(false)} />
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: OUTER_PAD,
              paddingBottom: 28,
              gap: CARD_GAP,
            }}
          >
            <AppText variant="h3">{t("calendar.panchangam")}</AppText>
            <DateCalendar
              value={selectedDate}
              allowAnyDate
              showSelectedFooter={false}
              onChange={(iso) => {
                setSelectedDate(iso);
                setPickerOpen(false);
              }}
            />
            <PrimaryButton title={t("common.close")} variant="outline" onPress={() => setPickerOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
