import {
  ADMIN_CUSTOMER_BLOCKED_FILTERS,
  DEFAULT_ADMIN_PAGE_SIZE,
  formatIndianPhone,
  normalizeIndianMobile,
  personLocation,
  PREFERRED_LANGUAGES,
  validateAdminCustomerForm,
} from "@bseva/config";
import type { Paginated } from "@bseva/types";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { confirmAdminAction, showAdminActionSheet, type ActionSheetOption } from "@/components/admin/adminActionSheet";
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
  PrimaryButton,
  Screen,
  StatusBadge,
  SuccessBanner,
} from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type CustomerRow = {
  id: string;
  public_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  blocked?: boolean;
  preferred_language?: string;
  location_label?: string;
  city?: string;
  district?: string;
  state?: string;
  location?: string;
};

const PAGE_SIZE = DEFAULT_ADMIN_PAGE_SIZE;

function languageLabel(code: string | null | undefined) {
  const match = PREFERRED_LANGUAGES.find((l) => l.code === (code || "en"));
  return match?.label || "English";
}

function CustomerManageModal({
  customer,
  visible,
  onClose,
  onUpdated,
}: {
  customer: CustomerRow | null;
  visible: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { colors } = useAppTheme();
  const { can } = useAdmin();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!customer) return null;

  async function updateLanguage(code: string) {
    setError(null);
    setBusy(true);
    try {
      await apiClient.api(`/admin/users/${customer!.id}/customer`, {
        method: "PUT",
        body: JSON.stringify({ preferred_language: code }),
      });
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update language.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlock() {
    setError(null);
    setBusy(true);
    try {
      await apiClient.api(`/admin/users/${customer!.id}/block`, {
        method: "POST",
        body: JSON.stringify({
          blocked: !customer!.blocked,
          reason: customer!.blocked ? null : "Blocked by admin",
        }),
      });
      onUpdated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update status.");
    } finally {
      setBusy(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      "Cannot delete customer",
      "Bookings stay linked to this account. Use Block to stop access.",
      [{ text: "OK" }]
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <AppText variant="h3" style={{ flex: 1 }} numberOfLines={1}>
            {customer.name || "Customer"}
          </AppText>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={{ minWidth: 36, minHeight: 36, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <ErrorBanner message={error} />
          <Card compact>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <AppText variant="h3" style={{ flex: 1 }} numberOfLines={2}>
                {customer.name}
              </AppText>
              <StatusBadge status={customer.blocked ? "blocked" : "active"} />
            </View>
            <AppText variant="small" color={colors.mutedForeground} style={{ fontFamily: "monospace", marginTop: 4 }}>
              {customer.public_id || "—"}
            </AppText>
            <AppText variant="small" color={colors.mutedForeground} style={{ marginTop: 4 }}>
              {customer.email || "—"}
            </AppText>
            <AppText variant="small" color={colors.mutedForeground}>
              {formatIndianPhone(customer.phone)}
            </AppText>
            <AppText variant="small" color={colors.mutedForeground} style={{ marginTop: 4 }}>
              {personLocation(customer)}
            </AppText>
          </Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText variant="small">Language: {languageLabel(customer.preferred_language)}</AppText>
            {can("edit_customers") ? (
              <Pressable
                onPress={() =>
                  showAdminActionSheet(
                    "Preferred language",
                    PREFERRED_LANGUAGES.map((l) => ({
                      label: l.label,
                      onPress: () => void updateLanguage(l.code),
                    }))
                  )
                }
                disabled={busy}
                style={{ paddingHorizontal: 10, paddingVertical: 6 }}
              >
                <AppText variant="small" color={colors.primary} style={{ fontWeight: "700" }}>
                  Edit
                </AppText>
              </Pressable>
            ) : null}
          </View>
          {can("edit_customers") ? (
            <>
              <PrimaryButton
                title={customer.blocked ? t("admin.unblock") : t("admin.block")}
                variant="outline"
                loading={busy}
                onPress={() =>
                  confirmAdminAction(
                    customer.blocked ? "Unblock customer?" : "Block customer?",
                    customer.blocked
                      ? "This customer will regain access to the app."
                      : "This customer will lose access until unblocked.",
                    () => void toggleBlock()
                  )
                }
              />
              <PrimaryButton title="Delete" variant="ghost" onPress={handleDelete} disabled />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function AdminCustomers() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { can } = useAdmin();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [blocked, setBlocked] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [manageCustomer, setManageCustomer] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", location: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const list = useQuery({
    queryKey: ["admin-customers", q, blocked, page, PAGE_SIZE],
    queryFn: () => {
      const qs = new URLSearchParams({ role: "customer", page: String(page), page_size: String(PAGE_SIZE) });
      if (q.trim()) qs.set("q", q.trim());
      if (blocked) qs.set("blocked", blocked);
      return apiClient.api<Paginated<CustomerRow>>(`/admin/users?${qs}`);
    },
  });

  const items = list.data?.items || [];
  const total = list.data?.total ?? 0;
  const pages = list.data?.pages ?? 1;

  async function handleAdd() {
    setError(null);
    setSuccess(null);
    const errors = validateAdminCustomerForm(form);
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
          role: "customer",
          location: form.location.trim(),
        }),
      });
      setForm({ name: "", email: "", phone: "", password: "", location: "" });
      setFieldErrors({});
      setAddOpen(false);
      setSuccess("Customer created successfully.");
      setPage(1);
      await qc.invalidateQueries({ queryKey: ["admin-customers"] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Customer creation failed.");
    } finally {
      setCreating(false);
    }
  }

  function openCustomerMenu(u: CustomerRow) {
    const options: ActionSheetOption[] = [
      {
        label: "View / Manage",
        onPress: () => setManageCustomer(u),
      },
    ];
    if (can("edit_customers")) {
      options.push({
        label: u.blocked ? t("admin.unblock") : t("admin.block"),
        onPress: () =>
          confirmAdminAction(
            u.blocked ? "Unblock customer?" : "Block customer?",
            u.blocked ? "This customer will regain access." : "This customer will lose access.",
            () => {
              void apiClient
                .api(`/admin/users/${u.id}/block`, {
                  method: "POST",
                  body: JSON.stringify({ blocked: !u.blocked, reason: u.blocked ? null : "Blocked by admin" }),
                })
                .then(() => list.refetch())
                .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed"));
            }
          ),
        destructive: !u.blocked,
      });
      options.push({
        label: "Delete",
        onPress: () =>
          Alert.alert("Cannot delete customer", "Bookings stay linked. Use Block to stop access.", [{ text: "OK" }]),
        destructive: true,
      });
    }
    showAdminActionSheet(u.name || "Customer", options);
  }

  return (
    <Screen watermark={false}>
      <AdminListHeader
        title={t("admin.customers")}
        back
        onAdd={can("create_customers") ? () => setAddOpen(true) : undefined}
        showAdd={can("create_customers")}
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
          options={[...ADMIN_CUSTOMER_BLOCKED_FILTERS]}
          value={blocked}
          onChange={(v) => {
            setBlocked(String(v));
            setPage(1);
          }}
        />
        {list.isLoading ? <LoadingBlock /> : null}
        {list.error ? <ErrorBanner message={list.error instanceof Error ? list.error.message : "Failed to load customers"} /> : null}
        {items.length === 0 && !list.isLoading ? <EmptyState title="No customers match this filter." /> : null}
        {items.map((u) => (
          <Card key={u.id} compact>
            <Pressable onPress={() => setManageCustomer(u)}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <AppText variant="h3" style={{ flex: 1 }} numberOfLines={1}>
                  {u.name}
                </AppText>
                <StatusBadge status={u.blocked ? "blocked" : "active"} />
              </View>
              <AppText variant="small" color={colors.mutedForeground} style={{ fontFamily: "monospace", marginTop: 2 }}>
                {u.public_id || "—"}
              </AppText>
              {u.email ? (
                <AppText variant="small" color={colors.mutedForeground} numberOfLines={1} style={{ marginTop: 2 }}>
                  {u.email}
                </AppText>
              ) : null}
              {u.phone ? (
                <AppText variant="small" color={colors.mutedForeground}>
                  {formatIndianPhone(u.phone)}
                </AppText>
              ) : null}
              <AppText variant="small" color={colors.mutedForeground} numberOfLines={2} style={{ marginTop: 2 }}>
                {personLocation(u)}
              </AppText>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <AppText variant="small" color={colors.mutedForeground}>
                Language: {languageLabel(u.preferred_language)}
              </AppText>
              {can("edit_customers") ? (
                <Pressable
                  onPress={() =>
                    showAdminActionSheet(
                      "Preferred language",
                      PREFERRED_LANGUAGES.map((l) => ({
                        label: l.label,
                        onPress: () => {
                          void apiClient
                            .api(`/admin/users/${u.id}/customer`, {
                              method: "PUT",
                              body: JSON.stringify({ preferred_language: l.code }),
                            })
                            .then(() => list.refetch())
                            .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed"));
                        },
                      }))
                    )
                  }
                  style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                >
                  <AppText variant="small" color={colors.primary} style={{ fontWeight: "700" }}>
                    Edit
                  </AppText>
                </Pressable>
              ) : null}
            </View>
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
              <Pressable onPress={() => setManageCustomer(u)} style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}>
                <AppText variant="small" color={colors.primary} style={{ fontWeight: "600" }}>
                  View / Manage
                </AppText>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => openCustomerMenu(u)}
                accessibilityRole="button"
                accessibilityLabel="More actions"
                style={{ minWidth: 36, minHeight: 36, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="ellipsis-vertical" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </Card>
        ))}
        {total > 0 ? (
          <AdminPagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
        ) : null}
      </ScrollView>

      <CustomerManageModal
        customer={manageCustomer}
        visible={!!manageCustomer}
        onClose={() => setManageCustomer(null)}
        onUpdated={() => {
          void list.refetch();
          setManageCustomer(null);
        }}
      />

      <AdminFormModal
        visible={addOpen}
        title="Add customer"
        onClose={() => setAddOpen(false)}
        submitLabel={creating ? "Adding…" : "Add customer"}
        onSubmit={() => void handleAdd()}
        loading={creating}
      >
        <Field label="Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} error={fieldErrors.name} />
        <Field label="Email" value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} autoCapitalize="none" keyboardType="email-address" error={fieldErrors.email} />
        <Field label="Phone" value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" error={fieldErrors.phone} />
        <Field label="City / area" value={form.location} onChangeText={(v) => setForm((f) => ({ ...f, location: v }))} error={fieldErrors.location} />
        <Field label="Password" value={form.password} onChangeText={(v) => setForm((f) => ({ ...f, password: v }))} secureTextEntry error={fieldErrors.password} />
      </AdminFormModal>
    </Screen>
  );
}
