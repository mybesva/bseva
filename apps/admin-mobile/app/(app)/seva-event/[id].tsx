import { displayTokenLabel } from "@bseva/config";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";
import { AppText, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SevaEventFormModal } from "@/components/admin/SevaEventForm";
import { useAdmin } from "@/providers/AdminProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function AdminSevaEventDetailScreen() {
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useAdmin();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
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
  // The list row carries every editable field (temple, pujari, cutoff…), same as the web edit source.
  const events = useQuery({
    queryKey: ["admin-seva-events"],
    queryFn: () => apiClient.adminListSevaEvents(),
    enabled: !!id && can("manage_seva_events"),
  });
  const eventRow = (events.data || []).find((e) => String(e.id) === String(id)) || manifest.data?.event || null;

  return (
    <Screen>
      <ScreenHeader title="Event Detail" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {manifest.isLoading ? <LoadingBlock /> : null}
        {manifest.data?.event ? (
          <>
            <AppText variant="h2">{manifest.data.event.title || manifest.data.event.service_name}</AppText>
            <AppText color={colors.mutedForeground}>
              {displayTokenLabel(manifest.data.event.participation_mode, "")} · {manifest.data.event.registration_count} registrations
            </AppText>
          </>
        ) : null}
        {can("manage_seva_events") && eventRow ? (
          <PrimaryButton title="Edit Event" variant="outline" onPress={() => setEditOpen(true)} />
        ) : null}
        <AppText variant="h3">Registrations</AppText>
        {regs.isLoading ? <LoadingBlock /> : null}
        {(regs.data || []).map((r) => (
          <AppText key={r.id}>
            {r.registration_number} — {r.primary_name || "—"} ({displayTokenLabel(r.status, "")})
          </AppText>
        ))}
        <AppText variant="h3" style={{ marginTop: 12 }}>
          Sankalp Manifest
        </AppText>
        {(manifest.data?.participants || []).map((p, i) => (
          <AppText key={String(p.registration_number || i)}>
            {String(p.primary_name || p.customer_name)} · {String(p.gotra || "—")} · {String(p.sankalp_text || "")}
          </AppText>
        ))}
      </ScrollView>
      <SevaEventFormModal
        visible={editOpen}
        event={eventRow}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          void manifest.refetch();
          void qc.invalidateQueries({ queryKey: ["admin-seva-events"] });
        }}
      />
    </Screen>
  );
}
