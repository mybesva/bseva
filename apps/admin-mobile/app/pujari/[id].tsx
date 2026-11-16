import {
  PUJARI_DOC_TYPES,
  PUJARI_SPECIALIZATIONS,
  displayTokenLabel,
  formatIndianPhone,
  personLocation,
  pujariDisplayStatus,
} from "@bseva/config";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { AdminFormModal } from "@/components/admin/AdminFormModal";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  AppText,
  Card,
  ChoiceChips,
  ErrorBanner,
  Field,
  LoadingBlock,
  PrimaryButton,
  Screen,
  StatusBadge,
  SuccessBanner,
} from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { downloadAuthorizedFile } from "@/utils/files";
import { useAppTheme } from "@/theme/ThemeContext";

type OfferSvc = { id: string; name: string; verified?: boolean };
type Doc = { id: string; document_type?: string; status?: string; uploaded_at?: string; uploaded_by_name?: string };
type HistoryRow = { action?: string; actor_name?: string; created_at?: string; notes?: string };
type Draft = Record<string, any>;

// Same option lists as web PujariDetail.tsx.
const QUAL_OPTS = [
  { id: "panchadasha", label: "Panchadasha Samskara" },
  { id: "kriya_kovida", label: "Kriya Kovida" },
  { id: "vidya_visharada", label: "Vidya Visharada" },
];
const LANG_OPTS = ["Sanskrit", "Hindi", "English", "Telugu", "Kannada", "Tamil", "Marathi"];
const SAMPRADAYA_OPTS = [
  { id: "smartha", label: "Smartha" },
  { id: "madhwa", label: "Madhwa" },
  { id: "vaishnava", label: "Vaishnava" },
];

const TEXT_FIELDS: { key: string; label: string; section: string; keyboard?: "numeric" | "phone-pad" | "decimal-pad"; multiline?: boolean; placeholder?: string }[] = [
  { key: "full_name", label: "Full Name", section: "Basic" },
  { key: "father_name", label: "Father Name", section: "Basic" },
  { key: "gotra", label: "Gotra", section: "Basic" },
  { key: "pravara", label: "Pravara", section: "Basic" },
  { key: "date_of_birth", label: "Date of Birth (YYYY-MM-DD)", section: "Basic", placeholder: "YYYY-MM-DD" },
  { key: "native_place", label: "Native Place", section: "Basic" },
  { key: "mobile_number", label: "Mobile", section: "Contact", keyboard: "phone-pad" },
  { key: "whatsapp_number", label: "WhatsApp", section: "Contact", keyboard: "phone-pad" },
  { key: "permanent_address", label: "Permanent Address", section: "Address", multiline: true },
  { key: "present_address", label: "Present Address", section: "Address", multiline: true },
  { key: "address_line1", label: "Address Line 1", section: "Address" },
  { key: "address_line2", label: "Address Line 2", section: "Address" },
  { key: "city", label: "City", section: "Address" },
  { key: "district", label: "District", section: "Address" },
  { key: "state", label: "State", section: "Address" },
  { key: "pincode", label: "Pincode", section: "Address", keyboard: "numeric" },
  { key: "country", label: "Country", section: "Address" },
  { key: "location_label", label: "Location Label", section: "Address" },
  { key: "latitude", label: "Latitude", section: "Address", keyboard: "decimal-pad" },
  { key: "longitude", label: "Longitude", section: "Address", keyboard: "decimal-pad" },
];

function optNum(v: unknown) {
  return v != null && v !== "" ? Number(v) : null;
}

function fmtDate(v: unknown) {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function listDisplay(v: unknown) {
  return Array.isArray(v) && v.length ? v.join(", ") : "—";
}

/** Light safeguards for the number/date inputs (web uses type=number/date with the same bounds). */
function validateDraft(d: Draft): Record<string, string> {
  const errors: Record<string, string> = {};
  const dob = d.date_of_birth ? String(d.date_of_birth).slice(0, 10) : "";
  if (dob && (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(new Date(dob).getTime()))) {
    errors.date_of_birth = "Use YYYY-MM-DD.";
  }
  const checkNum = (key: string, label: string, min?: number, max?: number) => {
    const v = d[key];
    if (v == null || v === "") return;
    const n = Number(v);
    if (!Number.isFinite(n)) errors[key] = `${label} must be a number.`;
    else if ((min != null && n < min) || (max != null && n > max)) errors[key] = `${label} must be between ${min} and ${max}.`;
  };
  checkNum("experience_years", "Experience", 0, 80);
  checkNum("service_radius_km", "Service radius", 1, 100);
  checkNum("qualification_year", "Qualification year");
  checkNum("latitude", "Latitude", -90, 90);
  checkNum("longitude", "Longitude", -180, 180);
  return errors;
}

function buildPatchBody(draft: Draft) {
  return {
    full_name: draft.full_name || null,
    father_name: draft.father_name || null,
    gotra: draft.gotra || null,
    pravara: draft.pravara || null,
    date_of_birth: draft.date_of_birth ? String(draft.date_of_birth).slice(0, 10) : null,
    native_place: draft.native_place || null,
    permanent_address: draft.permanent_address || null,
    present_address: draft.present_address || null,
    mobile_number: draft.mobile_number || null,
    whatsapp_number: draft.whatsapp_number || null,
    qualifications: draft.qualifications || [],
    qualification_year: draft.qualification_year ? Number(draft.qualification_year) : null,
    sampradaya: draft.sampradaya || null,
    website_publication_consent: !!draft.website_publication_consent,
    address_line1: draft.address_line1 || null,
    address_line2: draft.address_line2 || null,
    city: draft.city || null,
    district: draft.district || null,
    state: draft.state || null,
    pincode: draft.pincode || null,
    country: draft.country || null,
    location_label: draft.location_label || null,
    latitude: optNum(draft.latitude),
    longitude: optNum(draft.longitude),
    languages: draft.languages || [],
    specializations: draft.specializations || [],
    experience_years: optNum(draft.experience_years),
    available: !!draft.available,
    service_radius_km: optNum(draft.service_radius_km),
    bank_account_last4: draft.bank_account_last4 || null,
    bank_ifsc: draft.bank_ifsc || null,
    bank_holder_name: draft.bank_holder_name || null,
  };
}

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
  const [success, setSuccess] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  // GET /admin/pujaris/:id returns { profile, documents, public_id, ... } (same as web PujariDetail).
  const p = useMemo(() => {
    const d = q.data as (Record<string, unknown> & { profile?: Record<string, unknown>; documents?: Doc[] }) | undefined;
    if (!d) return undefined;
    return { ...(d.profile || {}), public_id: d.public_id ?? d.profile?.public_id, documents: d.documents } as Record<string, any> & {
      documents?: Doc[];
    };
  }, [q.data]);
  const documents = (p?.documents || []) as Doc[];
  const history = ((q.data as { verification_history?: HistoryRow[] } | undefined)?.verification_history || []) as HistoryRow[];
  const profileRaw = (q.data as { profile?: Draft } | undefined)?.profile;
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
  const canEdit = can("edit_pujaris");
  function setField(key: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }
  function openEdit() {
    setDraft({ ...(profileRaw || {}) });
    setEditErrors({});
    setEditOpen(true);
  }
  async function saveProfile() {
    const errs = validateDraft(draft);
    setEditErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await apiClient.api<{ auto_verified?: boolean } & Record<string, unknown>>(`/admin/pujaris/${id}`, {
        method: "PATCH",
        body: JSON.stringify(buildPatchBody(draft)),
      });
      setSuccess(updated?.auto_verified ? "Profile saved and automatically verified (admin completed)" : "Profile saved");
      setEditOpen(false);
      await q.refetch();
      await qc.invalidateQueries({ queryKey: ["admin-pujaris"] });
    } catch (e: unknown) {
      setEditErrors({ _form: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }
  const listChips = (key: "languages" | "specializations" | "qualifications", options: { id: string; label: string }[]) => (
    <ChoiceChips
      multiple
      options={options}
      value={Array.isArray(draft[key]) ? (draft[key] as string[]) : []}
      onChange={(next) => setField(key, Array.isArray(next) ? next : [next])}
    />
  );
  const sectionTitle = (title: string) => (
    <AppText variant="h3" style={{ marginTop: 8 }}>
      {title}
    </AppText>
  );
  const textInputs = (section: string) =>
    TEXT_FIELDS.filter((f) => f.section === section).map((f) => (
      <Field
        key={f.key}
        label={f.label}
        placeholder={f.placeholder}
        value={draft[f.key] == null ? "" : f.key === "date_of_birth" ? String(draft[f.key]).slice(0, 10) : String(draft[f.key])}
        onChangeText={(v) => setField(f.key, v)}
        keyboardType={f.keyboard}
        multiline={f.multiline}
        error={editErrors[f.key]}
      />
    ));

  return (
    <Screen watermark={false}>
      <ScreenHeader title={String(p.name || "Pujari")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <SuccessBanner message={success} />
        {canEdit ? <PrimaryButton title="Edit Profile" onPress={openEdit} /> : null}
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
        <Card compact style={{ gap: 4 }}>
          <AppText variant="h3">Profile Details</AppText>
          <AppText variant="small" color={colors.mutedForeground}>
            Available: {p.available ? "Yes" : "No"} · Radius: {p.service_radius_km != null ? `${p.service_radius_km} km` : "—"}
          </AppText>
          <AppText variant="small" color={colors.mutedForeground}>
            Languages: {listDisplay(p.languages)}
          </AppText>
          <AppText variant="small" color={colors.mutedForeground}>
            Specializations: {listDisplay(p.specializations)}
          </AppText>
          <AppText variant="small" color={colors.mutedForeground}>
            Qualifications: {listDisplay(p.qualifications)}
            {p.qualification_year ? ` (${p.qualification_year})` : ""}
          </AppText>
          {p.gotra || p.sampradaya ? (
            <AppText variant="small" color={colors.mutedForeground}>
              Gotra: {String(p.gotra || "—")} · Sampradaya: {p.sampradaya ? displayTokenLabel(String(p.sampradaya)) : "—"}
            </AppText>
          ) : null}
          {p.upi_id || p.bank_holder_name || p.bank_ifsc || p.bank_account_last4 ? (
            <>
              {p.upi_id ? (
                <AppText variant="small" color={colors.mutedForeground}>
                  UPI: {String(p.upi_id)}
                </AppText>
              ) : null}
              <AppText variant="small" color={colors.mutedForeground}>
                Bank: {String(p.bank_holder_name || "—")} · {String(p.bank_name || "—")} · IFSC {String(p.bank_ifsc || "—")} · A/c{" "}
                {p.bank_account_number ? String(p.bank_account_number) : p.bank_account_last4 ? `****${p.bank_account_last4}` : "—"}
              </AppText>
            </>
          ) : null}
        </Card>
        {offerServices.length ? (
          <Card compact>
            <AppText variant="h3">Verified Services</AppText>
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
              title="Save Verified Services"
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
                title="View / Share"
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
            <Field label="Approved Level" value={level} onChangeText={setLevel} keyboardType="number-pad" />
            <Field label="Rejection / Notes" value={reason} onChangeText={setReason} />
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
              title="Under Review"
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
              title="Request Correction"
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
        <Card compact>
          <AppText variant="h3">Verification History</AppText>
          {history.length === 0 ? (
            <AppText variant="small" color={colors.mutedForeground}>
              No history yet.
            </AppText>
          ) : null}
          {history.map((h, i) => (
            <View key={`${h.created_at}-${i}`} style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
              <AppText variant="small" style={{ fontWeight: "600" }}>
                {displayTokenLabel(h.action, "—")}
              </AppText>
              <AppText variant="small" color={colors.mutedForeground}>
                {h.actor_name || "System"} · {fmtDate(h.created_at)}
              </AppText>
            </View>
          ))}
        </Card>
      </ScrollView>

      <AdminFormModal
        visible={editOpen}
        title="Edit Profile"
        onClose={() => setEditOpen(false)}
        submitLabel={saving ? "Saving…" : "Save Profile"}
        onSubmit={() => void saveProfile()}
        loading={saving}
      >
        <AppText variant="small" color={colors.mutedForeground}>
          Completing the profile auto-verifies.
        </AppText>
        <ErrorBanner message={editErrors._form || null} />
        {sectionTitle("Basic")}
        {textInputs("Basic")}
        <AppText variant="small" color={colors.mutedForeground}>
          Sampradaya
        </AppText>
        <ChoiceChips options={SAMPRADAYA_OPTS} value={String(draft.sampradaya || "")} onChange={(v) => setField("sampradaya", String(v) || null)} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText variant="small">Website Publication Consent</AppText>
          <Switch value={!!draft.website_publication_consent} onValueChange={(v) => setField("website_publication_consent", v)} />
        </View>
        {sectionTitle("Contact")}
        {textInputs("Contact")}
        <AppText variant="small" color={colors.mutedForeground}>
          Email {String(p.email || "—")} · Account phone {formatIndianPhone(String(p.phone || ""))}
        </AppText>
        {sectionTitle("Address / District / Location")}
        {textInputs("Address")}
        {sectionTitle("Languages / Experience / Qualifications")}
        <Field
          label="Years of Experience"
          value={draft.experience_years == null ? "" : String(draft.experience_years)}
          onChangeText={(v) => setField("experience_years", v)}
          keyboardType="numeric"
          error={editErrors.experience_years}
        />
        <AppText variant="small" color={colors.mutedForeground}>
          Qualifications
        </AppText>
        {listChips("qualifications", QUAL_OPTS)}
        <Field
          label="Qualification Year"
          value={draft.qualification_year == null ? "" : String(draft.qualification_year)}
          onChangeText={(v) => setField("qualification_year", v)}
          keyboardType="numeric"
          error={editErrors.qualification_year}
        />
        <AppText variant="small" color={colors.mutedForeground}>
          Languages
        </AppText>
        {listChips("languages", LANG_OPTS.map((l) => ({ id: l, label: l })))}
        <AppText variant="small" color={colors.mutedForeground}>
          Specializations (legacy labels — approvals sync these automatically)
        </AppText>
        {listChips("specializations", PUJARI_SPECIALIZATIONS.map((x) => ({ id: x, label: x })))}
        {sectionTitle("Availability")}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText variant="small">Available for Bookings</AppText>
          <Switch value={!!draft.available} onValueChange={(v) => setField("available", v)} />
        </View>
        <Field
          label="Service Radius (Km)"
          value={draft.service_radius_km == null ? "" : String(draft.service_radius_km)}
          onChangeText={(v) => setField("service_radius_km", v)}
          keyboardType="numeric"
          error={editErrors.service_radius_km}
        />
        {sectionTitle("Bank")}
        <Field label="Bank Holder Name" value={String(draft.bank_holder_name || "")} onChangeText={(v) => setField("bank_holder_name", v)} />
        <Field
          label="IFSC"
          value={String(draft.bank_ifsc || "")}
          onChangeText={(v) => setField("bank_ifsc", v.toUpperCase())}
          autoCapitalize="characters"
        />
        <AppText variant="small" color={colors.mutedForeground}>
          Account {draft.bank_account_last4 ? `****${draft.bank_account_last4}` : "—"} (unchanged here)
        </AppText>
      </AdminFormModal>
    </Screen>
  );
}
