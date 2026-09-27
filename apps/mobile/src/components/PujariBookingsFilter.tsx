import { PUJARI_JOB_SEGMENTS, type PujariJobSegment } from "@bseva/config";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, TextInput, useWindowDimensions, View } from "react-native";
import { DatePickerField } from "@/components/DatePickerField";
import { SelectField } from "@/components/SelectField";
import { AppText } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { formatHumanDate } from "@/utils/formatDate";

export type PujariStatusFilter =
  | "all"
  | "pending"
  | "pending_acceptance"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";

const STATUS_FILTERS: PujariStatusFilter[] = [
  "all",
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "expired",
  "cancelled",
];

function statusLabel(status: PujariStatusFilter, t: (key: string) => string): string {
  if (status === "all") return t("web.pujariBookings.allStatuses");
  if (status === "expired") return t("web.status.expired");
  return t(`status.${status}`);
}

function segmentLabel(segment: PujariJobSegment, t: (key: string) => string): string {
  if (segment === "all") return t("common.all");
  if (segment === "upcoming") return t("web.pujariBookings.upcoming");
  if (segment === "completed") return t("status.completed");
  if (segment === "cancelled") return t("status.cancelled");
  if (segment === "expired") return t("web.status.expired");
  return segment;
}

export function PujariBookingsFilter({
  segment,
  status,
  from,
  to,
  qtext,
  count,
  loading,
  hasActiveFilters,
  onSegmentChange,
  onStatusChange,
  onFromChange,
  onToChange,
  onQtextChange,
  onClear,
}: {
  segment: PujariJobSegment;
  status: PujariStatusFilter;
  from: string;
  to: string;
  qtext: string;
  count: number;
  loading?: boolean;
  hasActiveFilters: boolean;
  onSegmentChange: (value: PujariJobSegment) => void;
  onStatusChange: (value: PujariStatusFilter) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onQtextChange: (value: string) => void;
  onClear: () => void;
}) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const rowGap = 10;
  const fieldRow = { flexDirection: narrow ? ("column" as const) : ("row" as const), gap: rowGap };
  const fieldCol = narrow ? {} : { flex: 1, minWidth: 0 };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 11,
            paddingHorizontal: 12,
            minHeight: 48,
            backgroundColor: colors.card,
          }}
        >
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            value={qtext}
            onChangeText={onQtextChange}
            placeholder={t("web.pujariBookings.searchPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel={t("common.search")}
            returnKeyType="search"
            style={{ flex: 1, color: colors.foreground, fontSize: 15, paddingVertical: 10 }}
          />
          {qtext ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.remove")} onPress={() => onQtextChange("")}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={fieldRow}>
        <View style={fieldCol}>
          <SelectField
            label={t("web.pujariBookings.list")}
            value={segment}
            placeholder={t("common.all")}
            options={PUJARI_JOB_SEGMENTS.map((id) => ({ id, label: segmentLabel(id, t) }))}
            onChange={(v) => onSegmentChange(v as PujariJobSegment)}
          />
        </View>
        <View style={fieldCol}>
          <SelectField
            label={t("common.status")}
            value={status}
            placeholder={t("web.pujariBookings.allStatuses")}
            options={STATUS_FILTERS.map((id) => ({ id, label: statusLabel(id, t) }))}
            onChange={(v) => onStatusChange(v as PujariStatusFilter)}
          />
        </View>
      </View>

      <View style={fieldRow}>
        <View style={fieldCol}>
          <DatePickerField
            label={t("common.from")}
            value={from}
            allowAnyDate
            formatValue={formatHumanDate}
            onChange={onFromChange}
          />
        </View>
        <View style={fieldCol}>
          <DatePickerField
            label={t("common.to")}
            value={to}
            allowAnyDate
            formatValue={formatHumanDate}
            onChange={onToChange}
          />
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {hasActiveFilters ? (
          <Pressable
            accessibilityRole="button"
            onPress={onClear}
            style={({ pressed }) => ({
              borderWidth: 1.5,
              borderColor: colors.primary,
              borderRadius: 10,
              paddingVertical: 8,
              paddingHorizontal: 14,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <AppText variant="small" color={colors.primary} style={{ fontWeight: "600" }}>
              {t("web.pujariBookings.clearFilters")}
            </AppText>
          </Pressable>
        ) : (
          <View />
        )}
        <AppText variant="small" color={colors.mutedForeground}>
          {loading ? t("common.loading") : t("web.pujariBookings.count", { count })}
        </AppText>
      </View>
    </View>
  );
}
