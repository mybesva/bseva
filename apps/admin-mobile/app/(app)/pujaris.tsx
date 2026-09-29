import {
  ADMIN_PUJARI_STATUS_FILTERS,
  DEFAULT_ADMIN_PAGE_SIZE,
  formatIndianPhone,
  normalizeIndianMobile,
  personLocation,
  pujariDisplayStatus,
  validateAdminPujariForm,
} from "@bseva/config";
import type { Paginated } from "@bseva/types";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { AdminFormModal } from "@/components/admin/AdminFormModal";
import { AdminListHeader } from "@/components/admin/AdminListHeader";
import { AdminPagination } from "@/components/admin/AdminPagination";
import {
  AppText,
  Card,
  ChoiceChips,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  Screen,
  StatusBadge,
  SuccessBanner,
} from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type PujariRow = {
  id: string;
  public_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  verification_status?: string;
  requested_level?: number;
  approved_level?: number;
  blocked?: boolean;
  location_label?: string;
  city?: string;
  district?: string;
  state?: string;
  location?: string;
  experience_years?: number | string | null;
  verified_service_count?: number;
  applied_service_count?: number;
  pending_service_review_count?: number;
  profile_completion_percentage?: number | null;
};

type PujariLevel = { level: number; title?: string };

const PAGE_SIZE = DEFAULT_ADMIN_PAGE_SIZE;

function levelLabel(level?: number | null) {
  if (level == null) return "—";
  if (level === 5) return "Level 5 — Chava Seva";
  if (level === 6) return "Level 6 — Pravachana Seva";
  return `Level ${level}`;
}

export default function AdminPujaris() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { can } = useAdmin();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ status?: string }>();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    location: "",
    requested_level: 2,
  });

  useEffect(() => {
    const next = typeof params.status === "string" ? params.status : "";
    setStatus(next);
    setPage(1);
  }, [params.status]);

  const levelsQuery = useQuery({
    queryKey: ["pujari-roles"],
    queryFn: () => apiClient.api<PujariLevel[] | { items?: PujariLevel[] }>("/pujari-roles"),
    enabled: addOpen,
  });
  const levels = useMemo(() => {
    const raw = levelsQuery.data;
    if (Array.isArray(raw)) return raw;
    return raw?.items || [
      { level: 1, title: "Level 1" },
      { level: 2, title: "Level 2" },
      { level: 3, title: "Level 3" },
      { level: 4, title: "Level 4" },
      { level: 5, title: "Chava Seva" },
      { level: 6, title: "Pravachana Seva" },
    ];
  }, [levelsQuery.data]);

  const list = useQuery({
    queryKey: ["admin-pujaris", q, status, page, PAGE_SIZE],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (q.trim()) qs.set("q", q.trim());
      if (status) qs.set("status", status);
      return apiClient.api<Paginated<PujariRow>>(`/admin/pujaris?${qs}`);
    },
  });

  const items = list.data?.items || [];
  const total = list.data?.total ?? 0;
  const pages = list.data?.pages ?? 1;

  async function handleAdd() {
    setError(null);
    setSuccess(null);
    const errors = validateAdminPujariForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const normalizedPhone = normalizeIndianMobile(form.phone);
    if (!normalizedPhone) {
      setFieldErrors({ phone: "Enter a valid phone number." });
      return;
    }
    setCreating(true);
    try {
      await apiClient.api("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: normalizedPhone,
          password: form.password,
          role: "pujari",
          location: form.location.trim(),
          requested_level: form.requested_level,
        }),
      });
      setForm({ name: "", email: "", phone: "", password: "", location: "", requested_level: 2 });
      setFieldErrors({});
      setAddOpen(false);
      setSuccess("Pujari added successfully.");
      setPage(1);
      await qc.invalidateQueries({ queryKey: ["admin-pujaris"] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add pujari.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Screen watermark={false}>
      <AdminListHeader
        title={t("admin.pujaris")}
        onAdd={can("create_pujaris") ? () => setAddOpen(true) : undefined}
        showAdd={can("create_pujaris")}
        addLabel="Add"
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
        keyboardShouldPersistTaps="handled"
      >
        <ErrorBanner message={error} />
        <SuccessBanner message={success} />
        <Field
          label={t("admin.search")}
          placeholder="Search ID, name, email, phone, location"
          value={q}
          onChangeText={(v) => {
            setQ(v);
            setPage(1);
          }}
        />
        <ChoiceChips
          horizontal
          options={[...ADMIN_PUJARI_STATUS_FILTERS]}
          value={status}
          onChange={(v) => {
            setStatus(String(v));
            setPage(1);
          }}
        />
        {list.isLoading ? <LoadingBlock /> : null}
        {list.error ? <ErrorBanner message={list.error instanceof Error ? list.error.message : "Failed to load pujaris"} /> : null}
        {items.length === 0 && !list.isLoading ? <EmptyState title="No pujaris match this filter." /> : null}
        {items.map((p) => {
          const displayStatus = pujariDisplayStatus(p);
          const location = personLocation(p);
          const approved = p.approved_level;
          const requested = p.requested_level;
          const verified = p.verified_service_count ?? 0;
          const applied = p.applied_service_count ?? 0;
          return (
            <Pressable key={p.id} onPress={() => router.push(`/pujari/${p.id}`)}>
              <Card compact>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <AppText variant="h3" style={{ flex: 1 }} numberOfLines={1}>
                    {p.name || "—"}
                  </AppText>
                  <StatusBadge status={displayStatus} />
                </View>
                <AppText variant="small" color={colors.mutedForeground} style={{ fontFamily: "monospace", marginTop: 2 }}>
                  {p.public_id || "—"}
                </AppText>
                {p.email ? (
                  <AppText variant="small" color={colors.mutedForeground} numberOfLines={1} style={{ marginTop: 2 }}>
                    {p.email}
                  </AppText>
                ) : null}
                {p.phone ? (
                  <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
                    {formatIndianPhone(p.phone)}
                  </AppText>
                ) : null}
                <AppText variant="small" color={colors.mutedForeground} numberOfLines={2} style={{ marginTop: 2 }}>
                  {location}
                </AppText>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                  <AppText variant="small">
                    {approved != null ? levelLabel(approved) : requested != null ? `Req. ${levelLabel(requested)}` : "—"}
                  </AppText>
                  <AppText variant="small" color={colors.mutedForeground}>
                    {p.experience_years != null && p.experience_years !== "" ? `${p.experience_years} yrs` : "—"}
                  </AppText>
                </View>
                {approved != null && requested != null && approved !== requested ? (
                  <AppText variant="small" color={colors.mutedForeground}>
                    Requested {levelLabel(requested)}
                  </AppText>
                ) : null}
                <AppText variant="small" color={colors.mutedForeground} style={{ marginTop: 4 }}>
                  Services: {verified} verified · {applied} applied
                  {(p.pending_service_review_count ?? 0) > 0 ? ` · ${p.pending_service_review_count} pending` : ""}
                </AppText>
                {p.profile_completion_percentage != null ? (
                  <AppText variant="small" color={colors.mutedForeground}>
                    Profile {p.profile_completion_percentage}% complete
                  </AppText>
                ) : null}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 8,
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <AppText variant="small" color={colors.primary} style={{ fontWeight: "600" }}>
                    View / Manage
                  </AppText>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </View>
              </Card>
            </Pressable>
          );
        })}
        {total > 0 ? (
          <AdminPagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
        ) : null}
      </ScrollView>

      <AdminFormModal
        visible={addOpen}
        title="Add pujari"
        onClose={() => setAddOpen(false)}
        submitLabel={creating ? "Adding…" : "Add pujari"}
        onSubmit={() => void handleAdd()}
        loading={creating}
      >
        <Field label="Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} error={fieldErrors.name} />
        <Field label="Email" value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} autoCapitalize="none" keyboardType="email-address" error={fieldErrors.email} />
        <Field label="Phone" value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" error={fieldErrors.phone} />
        <Field label="City / area" value={form.location} onChangeText={(v) => setForm((f) => ({ ...f, location: v }))} error={fieldErrors.location} />
        <AppText variant="small" color={colors.mutedForeground}>
          Level
        </AppText>
        <ChoiceChips
          horizontal
          options={levels.map((l) => ({ id: String(l.level), label: `L${l.level}` }))}
          value={String(form.requested_level)}
          onChange={(v) => setForm((f) => ({ ...f, requested_level: Number(v) }))}
        />
        {fieldErrors.requested_level ? <AppText variant="small" color={colors.destructive}>{fieldErrors.requested_level}</AppText> : null}
        <Field label="Password" value={form.password} onChangeText={(v) => setForm((f) => ({ ...f, password: v }))} secureTextEntry error={fieldErrors.password} />
      </AdminFormModal>
    </Screen>
  );
}
