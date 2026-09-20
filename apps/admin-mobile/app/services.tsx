import {
  adminServiceActivationError,
  buildAdminServicePayload,
  emptyAdminServiceForm,
  paiseFromRupees,
  rupees,
  rupeesField,
  type AdminServiceForm,
} from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { PujaTitle } from "@/components/PujaTitle";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

type Svc = AdminServiceForm & { id?: string; bookable?: boolean; available?: boolean; [key: string]: unknown };

function formFromRow(s: Svc): AdminServiceForm {
  const base = emptyAdminServiceForm();
  return {
    ...base,
    ...s,
    search_aliases_text: Array.isArray(s.search_aliases) ? (s.search_aliases as string[]).join(", ") : base.search_aliases_text,
    languages_text: Array.isArray(s.languages) ? (s.languages as string[]).join(", ") : s.languages_text || base.languages_text,
    process_steps_text: Array.isArray(s.process_steps)
      ? (s.process_steps as { text?: string }[]).map((p) => p.text || "").filter(Boolean).join("\n")
      : s.process_steps_text || "",
    category_slugs: Array.isArray(s.category_slugs) ? (s.category_slugs as string[]) : [],
    pricing_status: s.pricing_status === "priced" ? "priced" : "awaiting_pricing",
    samagri_review_status: (s.samagri_review_status as AdminServiceForm["samagri_review_status"]) || "UNVERIFIED",
  };
}

export default function AdminServices() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AdminServiceForm | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useQuery({
    queryKey: ["admin-services"],
    queryFn: () => apiClient.api<Svc[] | { items?: Svc[] }>("/admin/services"),
  });
  const rows = (Array.isArray(list.data) ? list.data : list.data?.items || []).filter((s) =>
    !q.trim() ? true : String(s.name || "").toLowerCase().includes(q.trim().toLowerCase())
  );

  async function save() {
    if (!form) return;
    const activation = adminServiceActivationError(form);
    if (activation) {
      setError(activation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = buildAdminServicePayload(form);
      if (editId) {
        await apiClient.api(`/admin/services/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiClient.api("/admin/services", { method: "POST", body: JSON.stringify(payload) });
      }
      setForm(null);
      setEditId(null);
      await list.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function set<K extends keyof AdminServiceForm>(key: K, value: AdminServiceForm[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  return (
    <Screen>
      <ScreenHeader title={t("admin.services")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        {form ? (
          <Card style={{ gap: 10 }}>
            <AppText variant="h3">{editId ? "Edit service" : "New service"}</AppText>
            <Field label="Name *" value={form.name} onChangeText={(v) => set("name", v)} />
            <Field label="Slug" value={form.slug} onChangeText={(v) => set("slug", v)} />
            <Field label="Description" value={form.description} onChangeText={(v) => set("description", v)} />
            <Field label="Short description" value={form.short_description} onChangeText={(v) => set("short_description", v)} />
            <Field label="Standard ₹" value={rupeesField(form.standard_price_paise)} onChangeText={(v) => set("standard_price_paise", paiseFromRupees(v))} keyboardType="decimal-pad" />
            <Field label="Premium ₹" value={rupeesField(form.premium_price_paise)} onChangeText={(v) => set("premium_price_paise", paiseFromRupees(v))} keyboardType="decimal-pad" />
            <Field label="Virtual domestic ₹" value={rupeesField(form.virtual_domestic_price_paise)} onChangeText={(v) => set("virtual_domestic_price_paise", paiseFromRupees(v))} keyboardType="decimal-pad" />
            <Field label="Virtual international ₹" value={rupeesField(form.virtual_international_price_paise)} onChangeText={(v) => set("virtual_international_price_paise", paiseFromRupees(v))} keyboardType="decimal-pad" />
            <Field label="Samagri ₹" value={rupeesField(form.samagri_price_paise)} onChangeText={(v) => set("samagri_price_paise", paiseFromRupees(v) ?? 0)} keyboardType="decimal-pad" />
            <Field label="Alankaram ₹" value={rupeesField(form.alankaram_price_paise)} onChangeText={(v) => set("alankaram_price_paise", paiseFromRupees(v) ?? 0)} keyboardType="decimal-pad" />
            <Field label="Food ₹" value={rupeesField(form.food_price_paise)} onChangeText={(v) => set("food_price_paise", paiseFromRupees(v) ?? 0)} keyboardType="decimal-pad" />
            <Field label="Duration (min)" value={String(form.duration_minutes)} onChangeText={(v) => set("duration_minutes", Number(v) || 90)} keyboardType="number-pad" />
            <Field label="Lead hours" value={String(form.booking_lead_hours ?? 48)} onChangeText={(v) => set("booking_lead_hours", Number(v) || 48)} keyboardType="number-pad" />
            <Field label="Required level" value={String(form.required_level)} onChangeText={(v) => set("required_level", Number(v) || 1)} keyboardType="number-pad" />
            <Field label="Pujaris required" value={String(form.pujaris_required)} onChangeText={(v) => set("pujaris_required", Number(v) || 1)} keyboardType="number-pad" />
            <Field label="Priests min" value={String(form.priests_min)} onChangeText={(v) => set("priests_min", Number(v) || 1)} keyboardType="number-pad" />
            <Field label="Priests max" value={String(form.priests_max)} onChangeText={(v) => set("priests_max", Number(v) || 1)} keyboardType="number-pad" />
            <Field label="Muhurtham fee ₹" value={rupeesField(form.muhurta_fee_paise)} onChangeText={(v) => set("muhurta_fee_paise", paiseFromRupees(v) ?? 0)} keyboardType="decimal-pad" />
            <Field label="Dakshina share %" value={String(form.dakshina_share_percent)} onChangeText={(v) => set("dakshina_share_percent", Number(v) || 0)} keyboardType="decimal-pad" />
            <Field label="Languages" value={form.languages_text} onChangeText={(v) => set("languages_text", v)} />
            <Field label="Search aliases" value={form.search_aliases_text} onChangeText={(v) => set("search_aliases_text", v)} />
            <Field label="Process steps (one per line)" value={form.process_steps_text} onChangeText={(v) => set("process_steps_text", v)} />
            {[
              ["virtual_available", "Virtual"],
              ["muhurta_consultation_enabled", "Muhurtham"],
              ["requires_muhurta", "Requires Muhurtham"],
              ["samagri_available", "Samagri available"],
              ["alankaram_available", "Alankaram available"],
              ["food_available", "Food available"],
              ["homa_included", "Homa included"],
              ["prasadam_included", "Prasadam included"],
              ["sankalpa_required", "Sankalpa required"],
              ["is_popular", "Popular"],
              ["is_featured_home", "Featured home"],
              ["is_seasonal", "Seasonal"],
              ["active", "Active"],
            ].map(([key, label]) => (
              <View key={key} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText>{label}</AppText>
                <Switch value={Boolean(form[key as keyof AdminServiceForm])} onValueChange={(v) => set(key as keyof AdminServiceForm, v as never)} />
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText>Priced</AppText>
              <Switch
                value={form.pricing_status === "priced"}
                onValueChange={(v) => set("pricing_status", v ? "priced" : "awaiting_pricing")}
              />
            </View>
            <PrimaryButton title={busy ? t("admin.save") : t("admin.save")} loading={busy} onPress={() => void save()} />
            <PrimaryButton title="Back to list" variant="outline" onPress={() => { setForm(null); setEditId(null); }} />
          </Card>
        ) : (
          <>
            <Field label={t("admin.search")} value={q} onChangeText={setQ} />
            <PrimaryButton title="Add service" onPress={() => { setEditId(null); setForm(emptyAdminServiceForm()); }} />
            {list.isLoading ? <LoadingBlock /> : null}
            {rows.map((s) => (
              <Card key={String(s.id)}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <PujaTitle name={s.name} variant="h3" style={{ flex: 1 }} />
                  <Switch
                    value={s.available !== false && s.bookable !== false && s.active !== false}
                    onValueChange={async (v) => {
                      setError(null);
                      try {
                        await apiClient.api(`/admin/services/${s.id}/availability`, { method: "PATCH", body: JSON.stringify({ available: v }) });
                        await list.refetch();
                      } catch (e: unknown) {
                        setError(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  />
                </View>
                <AppText variant="small">{s.slug} · {rupees(s.standard_price_paise)}</AppText>
                <PrimaryButton title="Edit" variant="outline" onPress={() => { setEditId(String(s.id)); setForm(formFromRow(s)); }} />
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
