import { Ionicons } from "@expo/vector-icons";
import {
  ASSIGN_SORT_OPTIONS,
  formatPujariDistance,
  searchAndSortPujaris,
  type AssignablePujari,
  type AssignSort,
} from "@bseva/config";
import { radius } from "@bseva/tokens";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { AppText, ChoiceChips, EmptyState, LoadingBlock } from "@/components/ui";
import { useAppTheme } from "@/theme/ThemeContext";

/** Shape of GET /admin/bookings/{id}/available-pujaris (pujaris already sorted nearest first). */
export type AvailablePujarisResponse = {
  current_pujari_id?: string | null;
  primary_ring_km?: number;
  booking_has_coordinates?: boolean;
  nearby_pujaris?: AssignablePujari[];
  other_pujaris?: AssignablePujari[];
  pujaris?: AssignablePujari[];
};

const SORT_CHIPS = ASSIGN_SORT_OPTIONS.map((o) => ({ id: o.value, label: o.label }));

/**
 * Search, sort and pick a pujari for a booking. Shows each pujari's distance from the puja location,
 * nearest first by default, with the pujaris within the default distance listed first.
 */
export function AssignPujariPicker({
  data,
  loading,
  selectedId,
  onSelect,
}: {
  data: AvailablePujarisResponse | undefined;
  loading: boolean;
  selectedId: string | null;
  onSelect: (p: AssignablePujari) => void;
}) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AssignSort>("nearest");
  const ring = data?.primary_ring_km ?? 10;
  const allNearby = data?.nearby_pujaris ?? [];
  const allOther = data?.other_pujaris ?? (data?.nearby_pujaris ? [] : data?.pujaris ?? []);
  const nearby = useMemo(() => searchAndSortPujaris(allNearby, query, sort), [allNearby, query, sort]);
  const other = useMemo(() => searchAndSortPujaris(allOther, query, sort), [allOther, query, sort]);

  if (loading) return <LoadingBlock />;
  if (!allNearby.length && !allOther.length) return <EmptyState title="No eligible pujari is free for this slot." />;

  const row = (p: AssignablePujari) => {
    const selected = p.id === selectedId;
    const current = p.id === data?.current_pujari_id;
    const meta = [
      formatPujariDistance(p.distance_km),
      p.experience_years != null ? `${p.experience_years} yrs` : null,
      p.city || p.location_label || null,
    ].filter(Boolean);
    return (
      <Pressable
        key={p.id}
        onPress={() => onSelect(p)}
        disabled={current}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled: current }}
        accessibilityLabel={`${p.name || "Pujari"}, ${meta.join(", ")}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 12,
          borderRadius: radius.md,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: colors.card,
          opacity: current ? 0.6 : 1,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}>{p.name || "Pujari"}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Level {p.approved_level ?? "—"}</Text>
            {current ? <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>Currently assigned</Text> : null}
            {p.schedule_conflict ? (
              <Text style={{ color: colors.destructive, fontSize: 12, fontWeight: "700" }}>Schedule conflict</Text>
            ) : null}
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{meta.join(" · ")}</Text>
        </View>
        <Ionicons
          name={selected ? "radio-button-on" : "radio-button-off"}
          size={22}
          color={selected ? colors.primary : colors.mutedForeground}
        />
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: colors.input,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 12,
          minHeight: 48,
        }}
      >
        <Ionicons name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, phone, area or puja"
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel="Search pujaris"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={{ flex: 1, color: colors.foreground, fontSize: 16, paddingVertical: 10 }}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      <ChoiceChips horizontal options={SORT_CHIPS} value={sort} onChange={(v) => setSort(v as AssignSort)} />
      {data?.booking_has_coordinates === false ? (
        <AppText variant="small" color={colors.mutedForeground}>
          This booking has no map location, so distances are not available.
        </AppText>
      ) : null}

      {query.trim() && !nearby.length && !other.length ? (
        <EmptyState title={`No pujari matches “${query.trim()}”.`} />
      ) : (
        <>
          {data?.booking_has_coordinates !== false ? (
            <AppText variant="small" style={{ fontWeight: "700" }}>{`Within ${ring} km`}</AppText>
          ) : null}
          {nearby.length ? (
            nearby.map(row)
          ) : data?.booking_has_coordinates !== false ? (
            <AppText variant="small" color={colors.mutedForeground}>
              {query.trim() ? `No pujari within ${ring} km matches this search.` : `No pujari available within ${ring} km.`}
            </AppText>
          ) : null}
          {other.length ? (
            <>
              {data?.booking_has_coordinates !== false ? (
                <AppText variant="small" style={{ fontWeight: "700", marginTop: 6 }}>
                  {`Farther than ${ring} km or distance unknown`}
                </AppText>
              ) : null}
              {other.map(row)}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}
