import { PUJARI_DOC_TYPES, displayTokenLabel, formatIndianPhone, personLocation, pujariDisplayStatus } from "@bseva/config";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { downloadAuthorizedFile } from "@/utils/files";
import { useAppTheme } from "@/theme/ThemeContext";

type OfferSvc = { id: string; name: string; verified?: boolean };
type Doc = { id: string; document_type?: string; status?: string; uploaded_at?: string; uploaded_by_name?: string };

export default function AdminPujariDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { can } = useAdmin();
  const { colors } = useAppTheme();
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

  useEffect(() => {
    if (p?.approved_level != null) setLevel(String(p.approved_level));
    else if (p?.requested_level != null) setLevel(String(p.requested_level));
  }, [p?.approved_level, p?.requested_level]);

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
    <Screen watermark={false}>
      <ScreenHeader title={String(p.name || "Pujari")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Card compact>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <AppText variant="h3" style={{ flex: 1 }} numberOfLines={1}>
              {String(p.name || "Pujari")}
            </AppText>
            <StatusBadge status={pujariDisplayStatus({ blocked: Boolean(p.blocked), verification_status: String(p.verification_status || "pending") })} />
          </View>
          {p.public_id ? (
            <AppText variant="small" color={colors.mutedForeground} style={{ fontFamily: "monospace", marginTop: 4 }}>
              {String(p.public_id)}
            </AppText>
          ) : null}
          {p.is_head_pujari || p.role === "head_pujari" ? (
            <AppText variant="small" color={colors.primary} style={{ marginTop: 4 }}>
              Head Pujari
            </AppText>
          ) : null}
          <AppText variant="small" color={colors.mutedForeground} style={{ marginTop: 4 }}>
            {String(p.email || "—")}
          </AppText>
          <AppText variant="small" color={colors.mutedForeground}>
            {formatIndianPhone(String(p.phone || ""))}
          </AppText>
          <AppText variant="small" color={colors.mutedForeground} style={{ marginTop: 4 }}>
            {personLocation({
              location: String(p.location || ""),
              location_label: String(p.location_label || ""),
              city: String(p.city || ""),
              district: String(p.district || ""),
              state: String(p.state || ""),
            })}
          </AppText>
          <AppText variant="small" style={{ marginTop: 6 }}>
            Approved level {String(p.approved_level ?? "—")} · Requested {String(p.requested_level ?? "—")}
          </AppText>
          {p.experience_years != null ? (
            <AppText variant="small" color={colors.mutedForeground}>
              {String(p.experience_years)} years experience
            </AppText>
          ) : null}
          {p.profile_completion_percentage != null ? (
            <AppText variant="small" color={colors.mutedForeground}>
              Profile {String(p.profile_completion_percentage)}% complete
            </AppText>
          ) : null}
        </Card>
        {offerServices.length ? (
          <Card compact>
            <AppText variant="h3">Verified services</AppText>
            <AppText variant="small" color={colors.mutedForeground}>
              {verifiedIds.length} verified · {offerServices.length} applied
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {offerServices.map((s) => {
                const on = verifiedIds.includes(s.id);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() =>
                      setVerified((prev) => {
                        const cur = prev ?? verifiedIds;
                        return cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [...cur, s.id];
                      })
                    }
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: on ? colors.primary : colors.border,
                      backgroundColor: on ? colors.primary + "18" : colors.secondary,
                    }}
                  >
                    <AppText variant="small" style={{ fontWeight: "600" }}>
                      {on ? "✓ " : ""}
                      {s.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
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
        <Card compact>
          <AppText variant="h3">Documents</AppText>
          {documents.length === 0 ? <AppText variant="small" color={colors.mutedForeground}>No documents uploaded yet.</AppText> : null}
          {documents.map((d) => (
            <View key={d.id} style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
              <AppText variant="small" color={colors.mutedForeground}>
                {PUJARI_DOC_TYPES.find((item) => item.id === d.document_type)?.label || displayTokenLabel(d.document_type, "")}
                {d.status ? ` · ${displayTokenLabel(d.status)}` : ""}
              </AppText>
              <PrimaryButton
                title="View / share"
                variant="outline"
                onPress={() =>
                  void downloadAuthorizedFile(
                    `/admin/pujaris/${id}/documents/${d.id}/file`,
                    `${d.document_type || "document"}-${d.id}`,
                    "application/octet-stream"
                  ).catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed"))
                }
              />
            </View>
          ))}
          {PUJARI_DOC_TYPES.map((typ) => (
            <PrimaryButton
              key={typ.id}
              title={`Upload ${typ.label}`}
              variant="outline"
              onPress={() =>
                void (async () => {
                  const picked = await DocumentPicker.getDocumentAsync({
                    type: ["application/pdf", "image/*"],
                    copyToCacheDirectory: true,
                  });
                  if (picked.canceled || !picked.assets[0]) return;
                  const asset = picked.assets[0];
                  try {
                    await apiClient.uploadAdminPujariDocument(
                      String(id),
                      { uri: asset.uri, name: asset.name || "document", type: asset.mimeType || "application/octet-stream" },
                      typ.id
                    );
                    await q.refetch();
                  } catch (e: unknown) {
                    Alert.alert("Upload failed", e instanceof Error ? e.message : "Failed");
                  }
                })()
              }
            />
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
          <Card compact>
            <AppText variant="h3">Verification</AppText>
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
                    body: JSON.stringify({ blocked: !p.blocked, reason: reason || "Admin action" }),
                  })
                )
              }
            />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
