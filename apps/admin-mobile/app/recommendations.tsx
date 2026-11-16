import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, ScrollView, Switch, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AdminFormModal } from "@/components/admin/AdminFormModal";
import { OptionPicker } from "@/components/admin/SevaEventForm";
import { AppText, Card, ChoiceChips, EmptyState, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type Rec = {
  id: string;
  title?: string;
  description?: string | null;
  service_id?: string;
  service_name?: string;
  audience?: string;
  month_number?: number | null;
  recurrence_hint?: string | null;
  active?: boolean;
  sort_order?: number;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const ANY_MONTH = "any";

const emptyForm = {
  service_id: "",
  title: "",
  description: "",
  audience: "customer",
  month_number: ANY_MONTH,
  recurrence_hint: "",
  active: true,
  sort_order: 0,
};

export default function AdminRecommendations() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { can } = useAdmin();
  const canManage = can("manage_recommendations");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["admin-recs"],
    queryFn: () => apiClient.api<Rec[] | { items?: Rec[] }>("/admin/recommendations"),
  });
  const services = useQuery({
    queryKey: ["admin-services"],
    queryFn: () => apiClient.api<{ id: string; name: string }[] | { items?: { id: string; name: string }[] }>("/admin/services"),
  });
  const rows = Array.isArray(list.data) ? list.data : list.data?.items || [];
  const serviceOptions = useMemo(() => {
    const all = Array.isArray(services.data) ? services.data : services.data?.items || [];
    return all.map((s) => ({ id: String(s.id), label: s.name }));
  }, [services.data]);

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setFormError(null);
    setOpen(true);
  }

  function openEdit(r: Rec) {
    setEditId(r.id);
    setForm({
      service_id: String(r.service_id || ""),
      title: r.title || "",
      description: r.description || "",
      audience: r.audience || "customer",
      month_number: r.month_number ? String(r.month_number) : ANY_MONTH,
      recurrence_hint: r.recurrence_hint || "",
      active: r.active !== false,
      sort_order: Number(r.sort_order) || 0,
    });
    setFormError(null);
    setOpen(true);
  }

  async function save() {
    if (!form.service_id) {
      setFormError("Pick a service to recommend");
      return;
    }
    if (form.title.trim().length < 2) {
      setFormError("Title must be at least 2 characters");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        service_id: form.service_id,
        title: form.title,
        description: form.description || null,
        audience: form.audience || "customer",
        month_number: form.month_number === ANY_MONTH ? null : Number(form.month_number),
        recurrence_hint: form.recurrence_hint || null,
        active: form.active,
        sort_order: Number(form.sort_order) || 0,
      };
      if (editId) {
        await apiClient.api(`/admin/recommendations/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiClient.api("/admin/recommendations", { method: "POST", body: JSON.stringify(payload) });
      }
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
      await list.refetch();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  function remove(r: Rec) {
    Alert.alert("Delete?", `Remove "${r.title || r.id}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setError(null);
          try {
            await apiClient.api(`/admin/recommendations/${r.id}`, { method: "DELETE" });
            await list.refetch();
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed");
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScreenHeader title={t("admin.recommendations")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <AppText variant="small" color={colors.mutedForeground}>
          Suggestions shown to customers on their dashboard. Pick a month to make one seasonal, or leave it on “Any
          month” to show it all year.
        </AppText>
        {canManage ? <PrimaryButton title="+ Add recommendation" onPress={openAdd} /> : null}
        {list.isLoading ? <LoadingBlock /> : null}
        {!list.isLoading && rows.length === 0 ? (
          <EmptyState title="No recommendations yet" subtitle="Add one to surface it on customer dashboards." />
        ) : null}
        {rows.map((r) => (
          <Card key={r.id} style={{ gap: 4 }}>
            <AppText variant="h3">{r.title}</AppText>
            <AppText variant="small" color={colors.mutedForeground}>
              {r.service_name || "—"} · {r.month_number ? MONTHS[r.month_number - 1] : "Any"} · Order {r.sort_order ?? 0} ·{" "}
              {r.active ? "active" : "inactive"}
            </AppText>
            {r.description ? <AppText variant="small">{r.description}</AppText> : null}
            {canManage ? (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Edit" variant="outline" onPress={() => openEdit(r)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Delete" variant="ghost" onPress={() => remove(r)} />
                </View>
              </View>
            ) : null}
          </Card>
        ))}
      </ScrollView>
      <AdminFormModal
        visible={open && canManage}
        title={editId ? "Edit Recommendation" : "Add Recommendation"}
        onClose={() => setOpen(false)}
        submitLabel={saving ? "Saving…" : editId ? "Save Changes" : "Add Recommendation"}
        onSubmit={() => void save()}
        loading={saving}
      >
        <ErrorBanner message={formError} />
        <OptionPicker
          label="Service *"
          options={serviceOptions}
          value={form.service_id}
          onChange={(service_id) => setForm({ ...form, service_id })}
          placeholder="Select service"
          loading={services.isLoading}
        />
        <Field
          label="Title *"
          placeholder="e.g. Shravan Satyanarayan Puja"
          value={form.title}
          onChangeText={(title) => setForm({ ...form, title })}
        />
        <Field
          label="Description"
          placeholder="Why this puja is recommended now"
          value={form.description}
          onChangeText={(description) => setForm({ ...form, description })}
          multiline
        />
        <AppText variant="small" color={colors.mutedForeground}>
          Month
        </AppText>
        <ChoiceChips
          options={[{ id: ANY_MONTH, label: "Any Month" }, ...MONTHS.map((m, i) => ({ id: String(i + 1), label: m }))]}
          value={form.month_number}
          onChange={(v) => setForm({ ...form, month_number: String(v) })}
        />
        <Field
          label="Sort Order"
          value={String(form.sort_order)}
          onChangeText={(v) => setForm({ ...form, sort_order: Number(v) || 0 })}
          keyboardType="number-pad"
        />
        <Field
          label="Recurrence Hint"
          placeholder="e.g. Every Purnima"
          value={form.recurrence_hint}
          onChangeText={(recurrence_hint) => setForm({ ...form, recurrence_hint })}
        />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <AppText>Active (shown to customers)</AppText>
          <Switch value={form.active} onValueChange={(active) => setForm({ ...form, active })} />
        </View>
      </AdminFormModal>
    </Screen>
  );
}
