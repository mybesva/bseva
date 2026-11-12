import { displayTokenLabel } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, TouchableOpacity, View } from "react-native";
import { AppText, ChoiceChips, EmptyState, ErrorBanner, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SevaEventFormModal } from "@/components/admin/SevaEventForm";
import { useAdmin } from "@/providers/AdminProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import type { SevaEvent } from "@bseva/types";

const FILTERS = ["all", "puja", "chadhava", "pravachan"];

export default function AdminSevaEventsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { can } = useAdmin();
  const canManage = can("manage_seva_events");
  const [filter, setFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SevaEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["admin-seva-events"],
    queryFn: () => apiClient.adminListSevaEvents(),
  });

  const rows = useMemo(() => {
    const all = q.data || [];
    return filter === "all" ? all : all.filter((e) => e.service_type === filter);
  }, [q.data, filter]);

  async function togglePublish(ev: SevaEvent) {
    setBusyId(ev.id);
    setError(null);
    try {
      await apiClient.api(`/admin/seva/events/${ev.id}`, {
        method: "PATCH",
        body: JSON.stringify({ published: !ev.published, status: ev.published ? "draft" : "published" }),
      });
      await q.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Seva Events" back />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
      >
        <ErrorBanner message={error || (q.error instanceof Error ? q.error.message : null)} />
        {canManage ? (
          <PrimaryButton
            title="Create Event"
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          />
        ) : null}
        <ChoiceChips
          horizontal
          options={FILTERS.map((f) => ({ id: f, label: displayTokenLabel(f) }))}
          value={filter}
          onChange={(v) => setFilter(String(v))}
        />
        {q.isLoading ? <LoadingBlock /> : null}
        {rows.length === 0 && !q.isLoading ? <EmptyState title="No events" /> : null}
        {rows.map((ev: SevaEvent) => (
          <TouchableOpacity
            key={ev.id}
            onPress={() => router.push({ pathname: "/(app)/seva-event/[id]", params: { id: ev.id } })}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 2,
            }}
          >
            <AppText variant="h3">{ev.title || ev.service_name}</AppText>
            {ev.temple_name ? <AppText color={colors.mutedForeground}>{ev.temple_name}</AppText> : null}
            <AppText color={colors.mutedForeground}>
              {displayTokenLabel(ev.service_type, "")}
              {ev.puja_event_kind ? ` (${displayTokenLabel(ev.puja_event_kind)})` : ""} · {displayTokenLabel(ev.participation_mode, "")} ·{" "}
              {ev.registration_count}
              {ev.capacity ? `/${ev.capacity}` : ""} regs
            </AppText>
            <AppText color={colors.mutedForeground}>{String(ev.start_at || "").slice(0, 16).replace("T", " ")}</AppText>
            <View style={{ marginTop: 6 }}>
              <AppText>{ev.published ? "Published" : "Draft"}</AppText>
            </View>
            {canManage ? (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title="Edit"
                    variant="outline"
                    onPress={() => {
                      setEditing(ev);
                      setFormOpen(true);
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title={ev.published ? "Unpublish" : "Publish"}
                    variant="outline"
                    loading={busyId === ev.id}
                    onPress={() => void togglePublish(ev)}
                  />
                </View>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
      <SevaEventFormModal
        visible={formOpen}
        event={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => void q.refetch()}
      />
    </Screen>
  );
}
