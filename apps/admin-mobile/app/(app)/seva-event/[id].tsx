import { displayTokenLabel } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";
import { AppText, LoadingBlock, Screen, ScreenHeader } from "@/components/ui";
import { apiClient } from "@/services/api";

export default function AdminSevaEventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const regs = useQuery({
    queryKey: ["admin-seva-regs", id],
    queryFn: () => apiClient.adminEventRegistrations(String(id)),
    enabled: !!id,
  });
  const manifest = useQuery({
    queryKey: ["admin-sankalp", id],
    queryFn: () => apiClient.adminSankalpManifest(String(id)),
    enabled: !!id,
  });

  return (
    <Screen>
      <ScreenHeader title="Event detail" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {manifest.isLoading ? <LoadingBlock /> : null}
        {manifest.data?.event ? (
          <>
            <AppText variant="h2">{manifest.data.event.title || manifest.data.event.service_name}</AppText>
            <AppText muted>
              {displayTokenLabel(manifest.data.event.participation_mode, "")} · {manifest.data.event.registration_count} registrations
            </AppText>
          </>
        ) : null}
        <AppText variant="h3">Registrations</AppText>
        {regs.isLoading ? <LoadingBlock /> : null}
        {(regs.data || []).map((r) => (
          <AppText key={r.id}>
            {r.registration_number} — {r.primary_name || "—"} ({displayTokenLabel(r.status, "")})
          </AppText>
        ))}
        <AppText variant="h3" style={{ marginTop: 12 }}>
          Sankalp manifest
        </AppText>
        {(manifest.data?.participants || []).map((p, i) => (
          <AppText key={String(p.registration_number || i)}>
            {String(p.primary_name || p.customer_name)} · {String(p.gotra || "—")} · {String(p.sankalp_text || "")}
          </AppText>
        ))}
      </ScrollView>
    </Screen>
  );
}
