import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { PujaTitle } from "@/components/PujaTitle";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, EmptyState, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type ConsultationStatus = "requested" | "in_progress" | "guided" | "completed" | "cancelled";
type Consultation = {
  id: string;
  consultation_number?: string;
  service_name?: string;
  customer_name?: string;
  appointment_date?: string;
  appointment_time?: string;
  status: ConsultationStatus;
  payment_status?: string;
  guidance_notes?: string | null;
  linked_booking_id?: string | null;
};

const statuses: ConsultationStatus[] = ["requested", "in_progress", "guided", "completed", "cancelled"];

export default function MuhurthamScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { refresh: refreshBadges } = useAdmin();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Consultation | null>(null);
  const [status, setStatus] = useState<ConsultationStatus>("requested");
  const [notes, setNotes] = useState("");
  const [linkedBookingId, setLinkedBookingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["muhurtham"],
    queryFn: () => apiClient.listMuhurta() as Promise<Consultation[]>,
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list.data || []).filter((row) => {
      if (filter === "actionable" && !["requested", "in_progress"].includes(row.status)) return false;
      if (filter !== "all" && filter !== "actionable" && row.status !== filter) return false;
      return !q || [row.consultation_number, row.customer_name, row.service_name, row.linked_booking_id]
        .some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [filter, list.data, query]);

  function open(row: Consultation) {
    setEditing(row);
    setStatus(row.status);
    setNotes(row.guidance_notes || "");
    setLinkedBookingId(row.linked_booking_id || "");
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.updateMuhurta(editing.id, {
        status,
        guidance_notes: notes,
        linked_booking_id: linkedBookingId.trim() || undefined,
      });
      setEditing(null);
      await Promise.all([list.refetch(), refreshBadges()]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("mobile.failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("admin.muhurtham")} back />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      >
        <ErrorBanner message={error || (list.error instanceof Error ? list.error.message : null)} />
        <Field label={t("admin.search")} value={query} onChangeText={setQuery} />
        <ChoiceChips
          options={[
            { id: "all", label: t("mobile.allStatuses") },
            { id: "actionable", label: t("mobile.actionRequired") },
            ...statuses.map((item) => ({ id: item, label: t(`status.${item}`) })),
          ]}
          value={filter}
          onChange={(value) => setFilter(String(value))}
        />
        {filter === "actionable" ? (
          <AppText variant="small" color={colors.mutedForeground}>
            Shows consultations awaiting admin action (requested or in progress).
          </AppText>
        ) : null}
        {list.isLoading ? <LoadingBlock /> : null}
        {!list.isLoading && rows.length === 0 ? <EmptyState title={t("mobile.noMuhurtham")} /> : null}
        {rows.map((row) => (
          <Pressable key={row.id} onPress={() => open(row)}>
            <Card style={{ gap: 5 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                {row.service_name ? (
                  <PujaTitle name={row.service_name} variant="h3" style={{ flex: 1 }} />
                ) : (
                  <AppText variant="h3" style={{ flex: 1 }}>{row.consultation_number}</AppText>
                )}
                <StatusBadge status={row.status} />
              </View>
              <AppText>{row.customer_name || "—"}</AppText>
              {row.service_name ? <PujaTitle name={row.service_name} variant="small" /> : null}
              <AppText variant="small" color={colors.mutedForeground}>
                {row.appointment_date || "—"} {row.appointment_time?.slice(0, 5) || ""}
              </AppText>
            </Card>
          </Pressable>
        ))}
        {editing ? (
          <Card style={{ gap: 10 }}>
            <AppText variant="h3">{editing.consultation_number || t("admin.muhurtham")}</AppText>
            <ChoiceChips
              options={statuses.map((item) => ({ id: item, label: t(`status.${item}`) }))}
              value={status}
              onChange={(value) => setStatus(String(value) as ConsultationStatus)}
            />
            <Field label={t("mobile.guidanceNotes")} value={notes} onChangeText={setNotes} multiline />
            <Field label={t("mobile.linkedBooking")} value={linkedBookingId} onChangeText={setLinkedBookingId} />
            <PrimaryButton title={saving ? t("mobile.saving") : t("admin.save")} loading={saving} onPress={() => void save()} />
            <PrimaryButton title={t("booking.cancel")} variant="ghost" onPress={() => setEditing(null)} />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
