import {
  adminServiceActivationError,
  buildAdminServicePayload,
  uniqueServiceSlug,
  emptyAdminServiceForm,
  emptyServiceCategoryForm,
  filterServiceCategories,
  matchesServiceSearch,
  paiseFromRupees,
  rupees,
  rupeesField,
  type AdminServiceForm,
} from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, View } from "react-native";
import { PujaTitle } from "@/components/PujaTitle";
import { ScreenHeader } from "@/components/ScreenHeader";
import { OptionPicker } from "@/components/admin/SevaEventForm";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { apiClient } from "@/services/api";

// Premium dakshina fields (same as web ServicesAdmin); declared here too so the form type always has them.
type ServiceForm = AdminServiceForm & {
  premium_dakshina_share_percent?: number | null;
  premium_dakshina_amount_paise?: number | null;
};

type Svc = ServiceForm & { id?: string; bookable?: boolean; available?: boolean; [key: string]: unknown };

function formFromRow(s: Svc): ServiceForm {
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
    premium_dakshina_amount_paise: Number(s.premium_dakshina_amount_paise) > 0 ? Number(s.premium_dakshina_amount_paise) : null,
    premium_dakshina_share_percent: s.premium_dakshina_share_percent != null ? Number(s.premium_dakshina_share_percent) : null,
  };
}

type Cat = { id: string; slug: string; name: string; description?: string; sort_order: number; active: boolean };

function ServiceCategories({ onError, search }: { onError: (v: string | null) => void; search: string }) {
  const list = useQuery({
    queryKey: ["admin-service-categories"],
    queryFn: () => apiClient.api<Cat[] | { items?: Cat[] }>("/admin/service-categories"),
  });
  const allRows = Array.isArray(list.data) ? list.data : list.data?.items || [];
  const rows = useMemo(() => filterServiceCategories(allRows, search), [allRows, search]);
  const [addForm, setAddForm] = useState({ ...emptyServiceCategoryForm });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyServiceCategoryForm });
  const [busy, setBusy] = useState(false);

  async function saveNew() {
    setBusy(true);
    onError(null);
    try {
      await apiClient.api("/admin/service-categories", { method: "POST", body: JSON.stringify(addForm) });
      setAddForm({ ...emptyServiceCategoryForm });
      await list.refetch();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(categoryId: string) {
    setBusy(true);
    onError(null);
    try {
      await apiClient.api(`/admin/service-categories/${categoryId}`, { method: "PUT", body: JSON.stringify(editForm) });
      setEditId(null);
      await list.refetch();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: 8 }}>
      <AppText variant="h3">Service Categories</AppText>
      {rows.map((c) => {
        const editing = editId === c.id;
        return (
          <Card key={c.id} style={{ gap: 8 }}>
            {editing ? (
              <>
                <AppText variant="h3">Edit Category</AppText>
                <Field label="Name" value={editForm.name} onChangeText={(name) => setEditForm({ ...editForm, name })} />
                <Field label="Slug" value={editForm.slug} onChangeText={(slug) => setEditForm({ ...editForm, slug })} />
                <Field label="Description" value={editForm.description} onChangeText={(description) => setEditForm({ ...editForm, description })} />
                <Field label="Sort Order" value={String(editForm.sort_order)} onChangeText={(v) => setEditForm({ ...editForm, sort_order: Number(v) || 0 })} keyboardType="number-pad" />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <AppText>Active</AppText>
                  <Switch value={editForm.active} onValueChange={(active) => setEditForm({ ...editForm, active })} />
                </View>
                <PrimaryButton title="Update Category" loading={busy} onPress={() => void saveEdit(c.id)} />
                <PrimaryButton title="Cancel" variant="ghost" onPress={() => setEditId(null)} />
              </>
            ) : (
              <>
                <AppText>{c.name} · {c.slug} · {c.active ? "active" : "off"}</AppText>
                <PrimaryButton
                  title="Edit"
                  variant="outline"
                  onPress={() => {
                    setEditId(c.id);
                    setEditForm({
                      slug: c.slug,
                      name: c.name,
                      description: c.description || "",
                      sort_order: c.sort_order,
                      active: c.active,
                    });
                  }}
                />
              </>
            )}
          </Card>
        );
      })}
      <AppText variant="h3">Add Category</AppText>
      <Field label="Name" value={addForm.name} onChangeText={(name) => setAddForm({ ...addForm, name })} />
      <Field label="Slug" value={addForm.slug} onChangeText={(slug) => setAddForm({ ...addForm, slug })} />
      <Field label="Description" value={addForm.description} onChangeText={(description) => setAddForm({ ...addForm, description })} />
      <Field label="Sort Order" value={String(addForm.sort_order)} onChangeText={(v) => setAddForm({ ...addForm, sort_order: Number(v) || 0 })} keyboardType="number-pad" />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <AppText>Active</AppText>
        <Switch value={addForm.active} onValueChange={(active) => setAddForm({ ...addForm, active })} />
      </View>
      <PrimaryButton title="Add Category" loading={busy && !editId} onPress={() => void saveNew()} />
    </Card>
  );
}

const KIT_PROVIDERS = ["BSEVA", "PUJARI", "INCLUDED_IN_SAMAGRI_PACKAGE"];
const isKitItem = (it: { provided_by?: string | null }) => KIT_PROVIDERS.includes(String(it.provided_by || "").toUpperCase());

/** Stored quantities sometimes include the unit: "50g" → 50 + g, "15 pcs" → 15 + pcs. */
function splitQty(value: unknown, unit?: string | null): { qty: string; unit: string } {
  const text = String(value ?? "").trim();
  const m = text.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  return m ? { qty: m[1], unit: m[2] || unit || "" } : { qty: text, unit: unit || "" };
}

/** "15" + "pcs" → "15 pcs"; "15 pcs" + "pcs" → "15 pcs". */
function qtyWithUnit(value: unknown, unit?: string | null): string {
  const v = String(value ?? "").trim();
  if (!v || !unit || /[a-z]/i.test(v)) return v;
  return `${v} ${unit}`;
}

type LinkedItem = {
  id?: string;
  samagri_item_id?: string;
  name?: string;
  qty_small?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  category?: string | null;
  provided_by?: string | null;
  optional?: boolean;
};
type MasterItem = { id: string; name: string; unit?: string | null };

/** Samagri items linked to one service: GET /services/:id/samagri, POST/DELETE /admin/services/:id/samagri. */
function ServiceSamagri({ serviceId, canManage }: { serviceId: string; canManage: boolean }) {
  const { colors } = useAppTheme();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkItemId, setLinkItemId] = useState("");
  const [linkQty, setLinkQty] = useState("");
  const [linkUnit, setLinkUnit] = useState("");
  const [linkCategory, setLinkCategory] = useState("PUJA_SAMAGRI");
  const [linkProvidedBy, setLinkProvidedBy] = useState("CUSTOMER");
  const [linkOptional, setLinkOptional] = useState(false);
  const linkedQ = useQuery({
    queryKey: ["admin-service-samagri", serviceId],
    queryFn: async () => {
      try {
        const data = await apiClient.api<LinkedItem[] | { items?: LinkedItem[] }>(`/services/${serviceId}/samagri`);
        return Array.isArray(data) ? data : data?.items || [];
      } catch {
        return [] as LinkedItem[];
      }
    },
  });
  const itemsQ = useQuery({
    queryKey: ["samagri"],
    queryFn: () => apiClient.api<MasterItem[] | { items?: MasterItem[] }>("/samagri/items"),
  });
  const linked = linkedQ.data || [];
  const master = Array.isArray(itemsQ.data) ? itemsQ.data : itemsQ.data?.items || [];
  const addedIds = new Set(linked.map((it) => String(it.samagri_item_id)));
  const itemOptions = master.map((it) => ({
    id: String(it.id),
    label: it.name,
    subtitle: addedIds.has(String(it.id)) ? "Already added (pick to edit)" : it.unit || undefined,
  }));

  function resetLinkForm() {
    setLinkItemId("");
    setLinkQty("");
    setLinkUnit("");
    setLinkCategory("PUJA_SAMAGRI");
    setLinkProvidedBy("CUSTOMER");
    setLinkOptional(false);
  }

  function editLinkedItem(it: LinkedItem) {
    const parts = splitQty(it.qty_small ?? it.quantity, it.unit);
    const provider = String(it.provided_by || "CUSTOMER").toUpperCase();
    setLinkItemId(String(it.samagri_item_id));
    setLinkQty(parts.qty);
    setLinkUnit(parts.unit);
    setLinkCategory(String(it.category || "PUJA_SAMAGRI"));
    setLinkProvidedBy(provider === "OPTIONAL" ? "CUSTOMER" : provider);
    setLinkOptional(Boolean(it.optional) || provider === "OPTIONAL");
  }

  function removeItem(it: LinkedItem) {
    Alert.alert("Remove item?", `Remove "${it.name}" from this puja's Samagri list?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setError(null);
          try {
            await apiClient.api(`/admin/services/${serviceId}/samagri/${it.samagri_item_id}`, { method: "DELETE" });
            if (String(linkItemId) === String(it.samagri_item_id)) resetLinkForm();
            await linkedQ.refetch();
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Remove failed");
          }
        },
      },
    ]);
  }

  async function saveLink() {
    if (!linkItemId) return;
    const parsedQty = parseFloat(linkQty);
    setBusy(true);
    setError(null);
    try {
      await apiClient.api(`/admin/services/${serviceId}/samagri`, {
        method: "POST",
        body: JSON.stringify({
          samagri_item_id: linkItemId,
          required: !linkOptional,
          optional: linkOptional,
          customer_provided: linkProvidedBy === "CUSTOMER",
          sort_order: linked.length,
          quantity: Number.isFinite(parsedQty) ? parsedQty : null,
          unit: linkUnit || null,
          category: linkCategory,
          provided_by: linkProvidedBy,
          qty_small: linkQty || null,
        }),
      });
      resetLinkForm();
      await linkedQ.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const kit = isKitItem({ provided_by: linkProvidedBy });
  return (
    <View style={{ gap: 8 }}>
      <ErrorBanner message={error} />
      {linkedQ.isLoading ? <LoadingBlock /> : null}
      {[
        { title: "Included in Kit", items: linked.filter(isKitItem) },
        { title: "Customer Arranges", items: linked.filter((it) => !isKitItem(it)) },
      ].map((group) => (
        <View key={group.title} style={{ gap: 4 }}>
          <AppText style={{ fontWeight: "700" }}>
            {group.title} ({group.items.length})
          </AppText>
          {group.items.length === 0 ? (
            <AppText variant="small" color={colors.mutedForeground}>
              None yet
            </AppText>
          ) : null}
          {group.items.map((it) => (
            <View key={String(it.samagri_item_id || it.id)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AppText variant="small" style={{ flex: 1 }}>
                {it.name}
                {it.qty_small || it.quantity != null ? ` — ${qtyWithUnit(it.qty_small || it.quantity, it.unit)}` : ""}
                {it.optional ? " (optional)" : ""}
              </AppText>
              {canManage && it.samagri_item_id ? (
                <>
                  <Pressable accessibilityRole="button" hitSlop={8} onPress={() => editLinkedItem(it)} style={{ padding: 6 }}>
                    <AppText variant="small" color={colors.primary}>
                      Edit
                    </AppText>
                  </Pressable>
                  <Pressable accessibilityRole="button" hitSlop={8} onPress={() => removeItem(it)} style={{ padding: 6 }}>
                    <AppText variant="small" color={colors.destructive}>
                      Remove
                    </AppText>
                  </Pressable>
                </>
              ) : null}
            </View>
          ))}
        </View>
      ))}
      {canManage ? (
        <Card style={{ gap: 8 }}>
          <OptionPicker
            label="Item"
            options={itemOptions}
            value={linkItemId}
            placeholder="Search or select an item"
            loading={itemsQ.isLoading}
            onChange={(id) => {
              const existing = linked.find((it) => String(it.samagri_item_id) === id);
              if (existing) {
                editLinkedItem(existing);
                return;
              }
              setLinkItemId(id);
              setLinkUnit(String(master.find((it) => String(it.id) === id)?.unit || ""));
            }}
          />
          <AppText variant="small" color={colors.mutedForeground}>
            Can&apos;t find it here? Add it first in Samagri, then come back and pick it.
          </AppText>
          <Field label="Quantity" placeholder="e.g. 2" value={linkQty} onChangeText={setLinkQty} keyboardType="decimal-pad" />
          <Field label="Unit" placeholder="e.g. pcs" value={linkUnit} onChangeText={setLinkUnit} autoCapitalize="none" />
          <AppText variant="small" color={colors.mutedForeground}>
            Who provides this?
          </AppText>
          <ChoiceChips
            options={[
              { id: "kit", label: "Included in Kit" },
              { id: "customer", label: "Customer Arranges" },
            ]}
            value={kit ? "kit" : "customer"}
            onChange={(v) => {
              if (v === "kit" && !kit) setLinkProvidedBy("BSEVA");
              if (v === "customer") setLinkProvidedBy("CUSTOMER");
            }}
          />
          <AppText variant="small" color={colors.mutedForeground}>
            If the customer doesn&apos;t buy the kit, kit items move to their &quot;arrange&quot; list.
          </AppText>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <AppText>Optional item</AppText>
            <Switch value={linkOptional} onValueChange={setLinkOptional} />
          </View>
          <PrimaryButton
            title={addedIds.has(linkItemId) ? "Update Item" : "Add Item"}
            variant="outline"
            disabled={!linkItemId}
            loading={busy}
            onPress={() => void saveLink()}
          />
          {linkItemId ? <PrimaryButton title="Clear" variant="ghost" onPress={resetLinkForm} /> : null}
        </Card>
      ) : null}
    </View>
  );
}

export default function AdminServices() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const { can } = useAdmin();
  const canServices = can("manage_services");
  const canSamagri = can("manage_samagri");
  const list = useQuery({
    queryKey: ["admin-services"],
    queryFn: () => apiClient.api<Svc[] | { items?: Svc[] }>("/admin/services"),
  });
  const allRows = Array.isArray(list.data) ? list.data : list.data?.items || [];
  const rows = allRows.filter((s) => matchesServiceSearch(s, q));
  // A saved puja keeps its slug even if renamed, so links already shared keep working.
  const serviceSlug = !form
    ? ""
    : editId
      ? form.slug
      : form.name.trim()
        ? uniqueServiceSlug(form.name, allRows.map((s) => String(s.slug)))
        : "";

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
      const payload = buildAdminServicePayload({ ...form, slug: serviceSlug });
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

  async function uploadImage() {
    if (!editId) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    if (asset.fileSize && asset.fileSize > 8 * 1024 * 1024) {
      setError("Image must be 8MB or smaller");
      return;
    }
    setImageBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", {
        uri: asset.uri,
        name: asset.fileName || "service.jpg",
        type: asset.mimeType || "image/jpeg",
      } as unknown as Blob);
      const data = await apiClient.upload<{ image_path?: string; image_url?: string }>(`/admin/services/${editId}/image`, body);
      setForm((f) => (f ? { ...f, image_path: data.image_path || f.image_path, image_url: data.image_url || f.image_url } : f));
      await list.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setImageBusy(false);
    }
  }

  function removeImage() {
    if (!editId) return;
    Alert.alert("Remove image?", "Remove this service image? The catalog will use the default placeholder.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setImageBusy(true);
          setError(null);
          try {
            await apiClient.api(`/admin/services/${editId}/image`, { method: "DELETE" });
            setForm((f) => (f ? { ...f, image_path: "", image_url: "" } : f));
            await list.refetch();
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Remove failed");
          } finally {
            setImageBusy(false);
          }
        },
      },
    ]);
  }

  function deleteService(s: Svc) {
    if (Number(s.booking_count || 0) > 0) return;
    Alert.alert("Delete service?", `Permanently remove ${s.name}? Only pujas with no bookings can be deleted.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setError(null);
          try {
            await apiClient.api(`/admin/services/${s.id}`, { method: "DELETE" });
            await list.refetch();
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed");
          }
        },
      },
    ]);
  }

  function set<K extends keyof ServiceForm>(key: K, value: ServiceForm[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  return (
    <Screen>
      <ScreenHeader title={t("admin.services")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        {form ? (
          <Card style={{ gap: 10 }}>
            <AppText variant="h3">{editId ? "Edit Service" : "New Service"}</AppText>
            <Field label="Name *" value={form.name} onChangeText={(v) => set("name", v)} />
            <Field label="Slug (Auto)" value={serviceSlug} editable={false} />
            <Field label="Description" value={form.description} onChangeText={(v) => set("description", v)} />
            <Field label="Short Description" value={form.short_description} onChangeText={(v) => set("short_description", v)} />
            <Field label="Standard ₹" value={rupeesField(form.standard_price_paise)} onChangeText={(v) => set("standard_price_paise", paiseFromRupees(v))} keyboardType="decimal-pad" />
            <Field label="Premium ₹" value={rupeesField(form.premium_price_paise)} onChangeText={(v) => set("premium_price_paise", paiseFromRupees(v))} keyboardType="decimal-pad" />
            <Field label="Virtual Domestic ₹" value={rupeesField(form.virtual_domestic_price_paise)} onChangeText={(v) => set("virtual_domestic_price_paise", paiseFromRupees(v))} keyboardType="decimal-pad" />
            <Field label="Virtual International ₹" value={rupeesField(form.virtual_international_price_paise)} onChangeText={(v) => set("virtual_international_price_paise", paiseFromRupees(v))} keyboardType="decimal-pad" />
            <Field label="Samagri ₹" value={rupeesField(form.samagri_price_paise)} onChangeText={(v) => set("samagri_price_paise", paiseFromRupees(v) ?? 0)} keyboardType="decimal-pad" />
            <Field label="Alankaram ₹" value={rupeesField(form.alankaram_price_paise)} onChangeText={(v) => set("alankaram_price_paise", paiseFromRupees(v) ?? 0)} keyboardType="decimal-pad" />
            <Field label="Food ₹" value={rupeesField(form.food_price_paise)} onChangeText={(v) => set("food_price_paise", paiseFromRupees(v) ?? 0)} keyboardType="decimal-pad" />
            <Field label="Duration (Min)" value={String(form.duration_minutes)} onChangeText={(v) => set("duration_minutes", Number(v) || 90)} keyboardType="number-pad" />
            <Field label="Lead Hours" value={String(form.booking_lead_hours ?? 48)} onChangeText={(v) => set("booking_lead_hours", Number(v) || 48)} keyboardType="number-pad" />
            <Field label="Required Level" value={String(form.required_level)} onChangeText={(v) => set("required_level", Number(v) || 1)} keyboardType="number-pad" />
            <AppText variant="small" color={colors.mutedForeground}>
              Levels 1–4 keep the existing hierarchy. Level 5 is Chava Seva. Level 6 is Pravachana Seva.
            </AppText>
            <Field label="Pujaris required" value={String(form.pujaris_required)} onChangeText={(v) => set("pujaris_required", Number(v) || 1)} keyboardType="number-pad" />
            <Field label="Priests Min" value={String(form.priests_min)} onChangeText={(v) => set("priests_min", Number(v) || 1)} keyboardType="number-pad" />
            <Field label="Priests Max" value={String(form.priests_max)} onChangeText={(v) => set("priests_max", Number(v) || 1)} keyboardType="number-pad" />
            <Field label="Muhurtham Fee ₹" value={rupeesField(form.muhurta_fee_paise)} onChangeText={(v) => set("muhurta_fee_paise", paiseFromRupees(v) ?? 0)} keyboardType="decimal-pad" />
            <Field label="Standard Dakshina Share %" value={String(form.dakshina_share_percent)} onChangeText={(v) => set("dakshina_share_percent", Number(v) || 0)} keyboardType="decimal-pad" />
            <Field
              label="Premium Dakshina Share % (Empty = Same as Standard)"
              value={form.premium_dakshina_share_percent == null ? "" : String(form.premium_dakshina_share_percent)}
              onChangeText={(v) => set("premium_dakshina_share_percent", v.trim() === "" ? null : Number(v) || 0)}
              keyboardType="decimal-pad"
            />
            <Field
              label="Standard Dakshina Fixed Amount ₹ (Optional, Replaces %)"
              value={rupeesField(form.dakshina_amount_paise)}
              onChangeText={(v) => set("dakshina_amount_paise", paiseFromRupees(v))}
              keyboardType="decimal-pad"
            />
            {Number(form.dakshina_amount_paise) > 0 ? (
              <Field
                label="Premium Dakshina Fixed Amount ₹ (Empty = Same as Standard)"
                value={rupeesField(form.premium_dakshina_amount_paise)}
                onChangeText={(v) => set("premium_dakshina_amount_paise", paiseFromRupees(v))}
                keyboardType="decimal-pad"
              />
            ) : null}
            <Field label="Languages" value={form.languages_text} onChangeText={(v) => set("languages_text", v)} />
            <Field label="Search Aliases" value={form.search_aliases_text} onChangeText={(v) => set("search_aliases_text", v)} />
            <Field label="Process Steps (One per Line)" value={form.process_steps_text} onChangeText={(v) => set("process_steps_text", v)} />
            {[
              ["virtual_available", "Virtual"],
              ["muhurta_consultation_enabled", "Muhurtham"],
              ["requires_muhurta", "Requires Muhurtham"],
              ["samagri_available", "Samagri Available"],
              ["alankaram_available", "Alankaram Available"],
              ["food_available", "Food available"],
              ["is_popular", "Popular"],
              ["is_featured_home", "Featured home"],
              ["is_seasonal", "Seasonal"],
              ["active", "Active"],
            ].map(([key, label]) => (
              <View key={key} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText>{label}</AppText>
                <Switch value={Boolean(form[key as keyof ServiceForm])} onValueChange={(v) => set(key as keyof ServiceForm, v as never)} />
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText>Priced</AppText>
              <Switch
                value={form.pricing_status === "priced"}
                onValueChange={(v) => set("pricing_status", v ? "priced" : "awaiting_pricing")}
              />
            </View>
            <AppText variant="h3" style={{ marginTop: 8 }}>
              Image
            </AppText>
            {editId ? (
              canServices ? (
                <>
                  <AppText variant="small" color={colors.mutedForeground}>
                    Upload a new file to replace the catalog image for this puja. JPG, PNG, WebP, or GIF up to 8MB.
                  </AppText>
                  <PrimaryButton
                    title={imageBusy ? "Uploading…" : form.image_url || form.image_path ? "Replace Image" : "Upload Image"}
                    variant="outline"
                    loading={imageBusy}
                    onPress={() => void uploadImage()}
                  />
                  {form.image_url || form.image_path ? (
                    <PrimaryButton title="Remove Image" variant="ghost" disabled={imageBusy} onPress={removeImage} />
                  ) : null}
                </>
              ) : null
            ) : (
              <AppText variant="small" color={colors.mutedForeground}>
                Save the new service first, then reopen Edit to upload or replace its image.
              </AppText>
            )}
            {form.image_url || form.image_path ? (
              <AppText variant="small" color={colors.mutedForeground}>
                Stored as: {form.image_url || form.image_path}
              </AppText>
            ) : null}
            <Field label="Image Path (Advanced)" placeholder="/images/services/example.jpg" value={form.image_path} onChangeText={(v) => set("image_path", v)} autoCapitalize="none" />
            <Field label="Image URL (Advanced)" placeholder="/images/services/example.jpg" value={form.image_url} onChangeText={(v) => set("image_url", v)} autoCapitalize="none" />
            <AppText variant="h3" style={{ marginTop: 8 }}>
              Samagri Items for This Puja
            </AppText>
            {editId ? (
              <>
                <ChoiceChips
                  options={[
                    { id: "VERIFIED", label: "Ready for Customers" },
                    { id: "UNVERIFIED", label: "Not Ready" },
                    { id: "NEEDS_REVIEW", label: "Needs Review" },
                  ]}
                  value={form.samagri_review_status}
                  onChange={(v) => set("samagri_review_status", String(v) as AdminServiceForm["samagri_review_status"])}
                />
                <AppText variant="small" color={colors.mutedForeground}>
                  Customers see this list on their booking receipt only when it is Ready for customers (saved with the service).
                </AppText>
                <ServiceSamagri serviceId={editId} canManage={canSamagri} />
              </>
            ) : (
              <AppText variant="small" color={colors.mutedForeground}>
                Save the service first to manage samagri items.
              </AppText>
            )}
            <PrimaryButton title={busy ? t("admin.save") : t("admin.save")} loading={busy} onPress={() => void save()} />
            <PrimaryButton title="Back to List" variant="outline" onPress={() => { setForm(null); setEditId(null); }} />
          </Card>
        ) : (
          <>
            <PrimaryButton title="+ Add service" onPress={() => { setEditId(null); setForm(emptyAdminServiceForm()); }} />
            <Field label="Search Services" placeholder="Search services…" value={q} onChangeText={setQ} />
            <ServiceCategories onError={setError} search={q} />
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
                {canServices ? (
                  <>
                    <PrimaryButton
                      title={Number(s.booking_count || 0) > 0 ? "Delete (Has Bookings)" : "Delete"}
                      variant="ghost"
                      disabled={Number(s.booking_count || 0) > 0}
                      onPress={() => deleteService(s)}
                    />
                    {Number(s.booking_count || 0) > 0 ? (
                      <AppText variant="small" color={colors.mutedForeground}>
                        Cannot delete — this puja has bookings. Set Coming Soon to hide it from customers.
                      </AppText>
                    ) : null}
                  </>
                ) : null}
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
