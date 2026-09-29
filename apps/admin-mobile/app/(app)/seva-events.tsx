import { displayTokenLabel } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, TouchableOpacity, View } from "react-native";
import { AppText, EmptyState, LoadingBlock, Screen, ScreenHeader } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import type { SevaEvent } from "@bseva/types";

export default function AdminSevaEventsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const q = useQuery({
    queryKey: ["admin-seva-events"],
    queryFn: () => apiClient.adminListSevaEvents(),
  });

  return (
    <Screen>
      <ScreenHeader title="Seva Events" />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
      >
        {q.isLoading ? <LoadingBlock /> : null}
        {(q.data || []).length === 0 && !q.isLoading ? <EmptyState title="No events" /> : null}
        {(q.data || []).map((ev: SevaEvent) => (
          <TouchableOpacity
            key={ev.id}
            onPress={() => router.push({ pathname: "/(app)/seva-event/[id]", params: { id: ev.id } })}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <AppText variant="h3">{ev.title || ev.service_name}</AppText>
            <AppText muted>
              {displayTokenLabel(ev.service_type, "")} · {displayTokenLabel(ev.participation_mode, "")} · {ev.registration_count}
              {ev.capacity ? `/${ev.capacity}` : ""} regs
            </AppText>
            <AppText muted>{String(ev.start_at || "").slice(0, 16)}</AppText>
            <View style={{ marginTop: 6 }}>
              <AppText>{ev.published ? "Published" : "Draft"}</AppText>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Screen>
  );
}
