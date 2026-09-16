import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

export default function AdminPujariDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { can } = useAdmin();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-pujari", id],
    queryFn: () => apiClient.api<Record<string, unknown>>(`/admin/pujaris/${id}`),
    enabled: !!id,
  });
  const [level, setLevel] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const p = q.data;
  if (q.isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t("admin.pujaris")} back />
        <LoadingBlock />
      </Screen>
    );
  }
  if (!p) {
    return (
      <Screen>
        <ScreenHeader title={t("admin.pujaris")} back />
        <ErrorBanner message="Not found" />
      </Screen>
    );
  }
  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await q.refetch();
      await qc.invalidateQueries({ queryKey: ["admin-pujaris"] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }
  return (
    <Screen>
      <ScreenHeader title={String(p.name || "Pujari")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Card>
          <StatusBadge status={String(p.verification_status || "pending")} />
          <AppText>{String(p.email || "")}</AppText>
          <AppText>{String(p.phone || "")}</AppText>
          <AppText>Level {String(p.approved_level ?? "—")}</AppText>
          <AppText variant="small">{String(p.city || p.location_label || "")}</AppText>
        </Card>
        {can(["verify_pujaris", "edit_pujaris"]) ? (
          <>
            <Field label="Approved level" value={level} onChangeText={setLevel} keyboardType="number-pad" />
            <Field label="Rejection / notes" value={reason} onChangeText={setReason} />
            <PrimaryButton
              title={t("admin.approve")}
              onPress={() =>
                void act(() =>
                  apiClient.api(`/admin/pujaris/${id}/verify`, {
                    method: "POST",
                    body: JSON.stringify({ verification_status: "approved", approved_level: Number(level || p.approved_level || 1) }),
                  })
                )
              }
            />
            <PrimaryButton
              title={t("admin.reject")}
              variant="outline"
              onPress={() =>
                void act(() =>
                  apiClient.api(`/admin/pujaris/${id}/verify`, {
                    method: "POST",
                    body: JSON.stringify({ verification_status: "rejected", rejection_reason: reason }),
                  })
                )
              }
            />
            <PrimaryButton
              title="Request correction"
              variant="ghost"
              onPress={() =>
                void act(() =>
                  apiClient.api(`/admin/pujaris/${id}/verify`, {
                    method: "POST",
                    body: JSON.stringify({ verification_status: "correction_required", rejection_reason: reason }),
                  })
                )
              }
            />
            <PrimaryButton
              title={p.blocked ? t("admin.unblock") : t("admin.block")}
              variant="outline"
              onPress={() =>
                void act(() =>
                  apiClient.api(`/admin/users/${id}/block`, {
                    method: "POST",
                    body: JSON.stringify({ blocked: !p.blocked, reason }),
                  })
                )
              }
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
