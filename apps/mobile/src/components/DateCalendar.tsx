import { isCalendarDayDisabled } from "@bseva/config";
import { Pressable, View } from "react-native";
import { useMemo, useState } from "react";
import { AppText } from "@/components/ui";
import { useAppTheme } from "@/theme/ThemeContext";
import { formatDisplayDate } from "@/utils/formatDate";

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function DateCalendar({
  value,
  onChange,
  leadHours = 48,
  minDate,
  showSelectedFooter = true,
}: {
  value: string;
  onChange: (iso: string) => void;
  leadHours?: number;
  minDate?: Date;
  showSelectedFooter?: boolean;
}) {
  const { colors } = useAppTheme();
  const selected = value ? parseIso(value) : new Date();
  const [cursor, setCursor] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const out: Array<{ iso: string; day: number; disabled: boolean } | null> = [];
    for (let i = 0; i < startWeekday; i++) out.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      out.push({
        iso: toIsoDate(d),
        day,
        disabled: isCalendarDayDisabled(d, leadHours, minDate || new Date()),
      });
    }
    return out;
  }, [cursor, leadHours, minDate]);

  const label = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous year"
          onPress={() => setCursor(new Date(cursor.getFullYear() - 1, cursor.getMonth(), 1))}
          style={{ minWidth: 36, minHeight: 44, justifyContent: "center" }}
        >
          <AppText variant="h3">«</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          style={{ minWidth: 36, minHeight: 44, justifyContent: "center" }}
        >
          <AppText variant="h3">‹</AppText>
        </Pressable>
        <AppText variant="h3" style={{ textAlign: "center", flex: 1 }}>
          {label}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          style={{ minWidth: 36, minHeight: 44, alignItems: "flex-end", justifyContent: "center" }}
        >
          <AppText variant="h3">›</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next year"
          onPress={() => setCursor(new Date(cursor.getFullYear() + 1, cursor.getMonth(), 1))}
          style={{ minWidth: 36, minHeight: 44, alignItems: "flex-end", justifyContent: "center" }}
        >
          <AppText variant="h3">»</AppText>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <AppText key={`${d}-${i}`} variant="small" color={colors.mutedForeground} style={{ flex: 1, textAlign: "center" }}>
            {d}
          </AppText>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((cell, i) => (
          <View key={i} style={{ width: "14.285%", aspectRatio: 1, padding: 2 }}>
            {cell ? (
              <Pressable
                disabled={cell.disabled}
                onPress={() => onChange(cell.iso)}
                accessibilityRole="button"
                accessibilityLabel={formatDisplayDate(cell.iso)}
                style={{
                  flex: 1,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: value === cell.iso ? colors.primary : "transparent",
                  opacity: cell.disabled ? 0.35 : 1,
                }}
              >
                <AppText color={value === cell.iso ? colors.primaryForeground : colors.foreground}>{String(cell.day)}</AppText>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
      {showSelectedFooter ? (
        <AppText variant="small" color={colors.mutedForeground}>
          {formatDisplayDate(value)}
        </AppText>
      ) : null}
    </View>
  );
}
