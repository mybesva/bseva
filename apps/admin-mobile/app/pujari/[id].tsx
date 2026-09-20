import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

type OfferSvc = { id: string; name: string; verified?: boolean };
type Doc = { id: string; document_type?: string; status?: string; uploaded_at?: string; uploaded_by_name?: string };

export default function AdminPujariDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { can } = useAdmin();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-pujari", id],
    queryFn: () => apiClient.api<Record<string, unknown> & { documents?: Doc[] }>(`/admin/pujaris/${id}`),
    enabled: !!id,
  });
  const offers = useQuery({
    queryKey: ["admin-pujari-offers", id],
    queryFn: () =>
      apiClient.api<{
        services?: OfferSvc[];
        verified_service_ids?: string[];
        pending_review_services?: OfferSvc[];
      }>(`/admin/pujaris/${id}/service-offers`),
    enabled: !!id,
  });
  const [level, setLevel] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<string[] | null>(null);
  const p = q.data;
  const documents = (p?.documents || []) as Doc[];
  const offerServices = offers.data?.services || [];
  const verifiedIds = useMemo(() => {
    if (verified) return verified;
    return offers.data?.verified_service_ids || offerServices.filter((s) => s.verified).map((s) => s.id);
  }, [verified, offers.data, offerServices]);

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
          {p.is_head_pujari || p.role === "head_pujari" ? (
            <AppText variant="small">Head Pujari</AppText>
          ) : null}
          <AppText>{String(p.email || "")}</AppText>
          <AppText>{String(p.phone || "")}</AppText>
          <AppText>Level {String(p.approved_level ?? "—")}</AppText>
          <AppText variant="small">{String(p.city || p.location_label || "")}</AppText>
        </Card>
        {offerServices.length ? (
          <Card>
            <AppText variant="h3">Admin verified services</AppText>
            <AppText variant="small">{verifiedIds.length} verified for bookings</AppText>
            {offerServices.map((s) => {
              const on = verifiedIds.includes(s.id);
              return (
                <PrimaryButton
                  key={s.id}
                  title={`${on ? "✓ " : ""}${s.name}`}
                  variant={on ? "primary" : "outline"}
                  onPress={() =>
                    setVerified((prev) => {
                      const cur = prev ?? verifiedIds;
                      return cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [...cur, s.id];
                    })
                  }
                />
              );
            })}
            <PrimaryButton
              title="Save verified services"
              onPress={() =>
                void act(async () => {
                  const out = await apiClient.api<{ verified_service_ids?: string[] }>(`/admin/pujaris/${id}/verified-services`, {
                    method: "PUT",
                    body: JSON.stringify({ service_ids: verifiedIds }),
                  });
                  setVerified(out.verified_service_ids || verifiedIds);
                  await offers.refetch();
                })
              }
            />
          </Card>
        ) : null}
        <Card>
          <AppText variant="h3">Documents</AppText>
          {documents.length === 0 ? <AppText variant="small">No documents uploaded yet.</AppText> : null}
          {documents.map((d) => (
            <AppText key={d.id} variant="small">
              {d.document_type} · {d.status || ""} · {d.uploaded_by_name || ""} · {d.uploaded_at || ""}
            </AppText>
          ))}
        </Card>
        {can(["approve_pujaris"]) ? (
          p.is_head_pujari || p.role === "head_pujari" ? (
            <PrimaryButton
              title="Remove Head Pujari"
              variant="outline"
              onPress={() =>
                void act(() =>
                  apiClient.api(`/admin/pujaris/${id}/head`, {
                    method: "POST",
                    body: JSON.stringify({ is_head_pujari: false, scope_cities: [] }),
                  })
                )
              }
            />
          ) : (
            <PrimaryButton
              title="Make Head Pujari"
              variant="outline"
              onPress={() =>
                void act(() =>
                  apiClient.api(`/admin/pujaris/${id}/head`, {
                    method: "POST",
                    body: JSON.stringify({ is_head_pujari: true, scope_cities: [] }),
                  })
                )
              }
            />
          )
        ) : null}
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
              title="Under review"
              variant="ghost"
              onPress={() =>
                void act(() =>
                  apiClient.api(`/admin/pujaris/${id}/verify`, {
                    method: "POST",
                    body: JSON.stringify({ verification_status: "under_review", rejection_reason: reason }),
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
