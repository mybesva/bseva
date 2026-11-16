import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AdminFormModal } from "@/components/admin/AdminFormModal";
import { AppText, Card, EmptyState, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type Item = {
  id: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  item_key?: string | null;
  active?: boolean;
  service_count?: number;
  translations?: Record<string, string>;
};

export default function AdminSamagri() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { can } = useAdmin();
  const canManage = can("manage_samagri");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [itemKey, setItemKey] = useState("");
  const [nameHi, setNameHi] = useState("");
  const [nameTe, setNameTe] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["samagri"],
    queryFn: () => apiClient.api<Item[] | { items?: Item[] }>("/samagri/items"),
  });
  const rows = Array.isArray(list.data) ? list.data : list.data?.items || [];

  function openForm(item?: Item) {
    setEditingId(item?.id ?? null);
    setName(item?.name ?? "");
    setDescription(item?.description ?? "");
    setUnit(item?.unit ?? "pcs");
    setItemKey(item?.item_key ?? "");
    setNameHi(item?.translations?.hi ?? "");
    setNameTe(item?.translations?.te ?? "");
    setFormError(null);
    setOpen(true);
  }

  async function saveItem() {
    if (!name.trim()) {
      setFormError("Name (English) is required");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiClient.api(editingId ? `/admin/samagri/items/${editingId}` : "/admin/samagri/items", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          name,
          description: description || null,
          unit,
          item_key: itemKey.trim() || null,
          active: true,
          translations: { en: name, hi: nameHi.trim(), te: nameTe.trim() },
        }),
      });
      setOpen(false);
      await list.refetch();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  function deleteItem(item: Item) {
    const used = item.service_count ?? 0;
    const impact = used ? ` It will be removed from ${used} puja${used === 1 ? "" : "s"}.` : "";
    Alert.alert("Delete item?", `Delete "${item.name}"?${impact}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setError(null);
          try {
            await apiClient.api(`/admin/samagri/items/${item.id}`, { method: "DELETE" });
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
      <ScreenHeader title={t("admin.samagri")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <AppText variant="small" color={colors.mutedForeground}>
          Master items with en / hi / te names. Link them per service in Services admin.
        </AppText>
        {canManage ? <PrimaryButton title="+ Add item" onPress={() => openForm()} /> : null}
        {list.isLoading ? <LoadingBlock /> : null}
        {!list.isLoading && rows.length === 0 ? <EmptyState title="No samagri items yet" subtitle="Add the first item." /> : null}
        {rows.map((item) => (
          <Card key={item.id} style={{ gap: 4 }}>
            <AppText variant="h3">{item.name}</AppText>
            <AppText variant="small" color={colors.mutedForeground}>
              {(item.translations?.hi || "—") + " / " + (item.translations?.te || "—")}
            </AppText>
            <AppText variant="small" color={colors.mutedForeground}>
              {[item.unit, item.item_key].filter(Boolean).join(" · ")}
              {item.unit || item.item_key ? " · " : ""}
              {item.service_count ?? 0} puja{item.service_count === 1 ? "" : "s"}
            </AppText>
            {canManage ? (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Edit" variant="outline" onPress={() => openForm(item)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Delete" variant="ghost" onPress={() => deleteItem(item)} />
                </View>
              </View>
            ) : null}
          </Card>
        ))}
      </ScrollView>
      <AdminFormModal
        visible={open && canManage}
        title={editingId ? "Edit Samagri Item" : "Add Samagri Item"}
        onClose={() => setOpen(false)}
        submitLabel={saving ? "Saving…" : "Save"}
        onSubmit={() => void saveItem()}
        loading={saving}
      >
        <ErrorBanner message={formError} />
        <Field label="Name (English) *" value={name} onChangeText={setName} />
        <Field label="Name (Hindi)" value={nameHi} onChangeText={setNameHi} />
        <Field label="Name (Telugu)" value={nameTe} onChangeText={setNameTe} />
        <Field label="Item Key" placeholder="e.g. turmeric" value={itemKey} onChangeText={setItemKey} autoCapitalize="none" />
        <Field label="Unit" value={unit} onChangeText={setUnit} autoCapitalize="none" />
        <Field label="Description" value={description} onChangeText={setDescription} />
      </AdminFormModal>
    </Screen>
  );
}
