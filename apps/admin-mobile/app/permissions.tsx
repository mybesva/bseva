import { ADMIN_PERMISSIONS } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, View } from "react-native";
import { AdminFormModal } from "@/components/admin/AdminFormModal";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, SuccessBanner } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type AdminRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string;
  blocked?: boolean;
  permissions?: string[];
};

type Catalog = {
  groups: { key: string; label: string; permissions: { key: string; label: string }[] }[];
  super_admin_only?: string[];
};

/** What a Super Admin keeps to themselves; shown so it's clear these are not assignable. */
const SUPER_ONLY_CAPABILITIES = [
  "Settlements & payout overrides",
  "Reports & financial exports",
  "Revenue, platform fee & payout KPIs",
  "Admin Permissions",
  "Platform settings (GST, roles, email / SMS)",
];

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));
const errMsg = (e: unknown, fallback = "Failed") => (e instanceof Error && e.message ? e.message : fallback);

export default function AdminPermissions() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // Add admin
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [adding, setAdding] = useState(false);

  // Change password
  const [pwFor, setPwFor] = useState<AdminRow | null>(null);
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const list = useQuery({
    queryKey: ["admins"],
    queryFn: () => apiClient.api<AdminRow[] | { items?: AdminRow[] }>("/admin/admins"),
  });
  const catalogQuery = useQuery({
    queryKey: ["admin-permissions-catalog"],
    queryFn: () => apiClient.api<Catalog>("/admin/permissions/catalog"),
  });
  const catalog = catalogQuery.data;
  const groups = useMemo<Catalog["groups"]>(
    () =>
      catalog?.groups?.length
        ? catalog.groups
        : [{ key: "all", label: "Permissions", permissions: ADMIN_PERMISSIONS.map((p) => ({ key: p, label: p })) }],
    [catalog]
  );
  const assignable = useMemo(() => groups.flatMap((g) => g.permissions.map((p) => p.key)), [groups]);

  const rows = Array.isArray(list.data) ? list.data : list.data?.items || [];
  const q = query.trim().toLowerCase();
  const visibleRows = rows.filter((a) => !q || [a.name, a.email, a.phone].some((v) => (v || "").toLowerCase().includes(q)));
  const current = rows.find((r) => r.id === selected);
  const isSuper = current?.role === "super_admin";
  const saved = useMemo(() => (current?.permissions || []).filter((p) => assignable.includes(p)), [current, assignable]);
  const dirty = !!current && !isSuper && !sameSet(saved, perms);

  function select(row: AdminRow) {
    setSelected(row.id);
    setPerms((row.permissions || []).filter((p) => assignable.includes(p)));
  }

  function requestSelect(row: AdminRow) {
    if (row.id === selected) return;
    if (!dirty) {
      select(row);
      return;
    }
    Alert.alert(
      "Discard unsaved changes?",
      `You changed permissions for ${current?.name || "this admin"} without saving. Switching admins will discard those changes.`,
      [
        { text: "Keep Editing", style: "cancel" },
        { text: "Discard Changes", style: "destructive", onPress: () => select(row) },
      ]
    );
  }

  const toggle = (key: string, on: boolean) =>
    setPerms((prev) => (on ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((p) => p !== key)));
  const setGroup = (keys: string[], on: boolean) =>
    setPerms((prev) => (on ? Array.from(new Set([...prev, ...keys])) : prev.filter((p) => !keys.includes(p))));

  async function save() {
    if (!current || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiClient.api<{ permissions?: string[] }>(`/admin/users/${current.id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions: perms }),
      });
      if (res?.permissions) setPerms(res.permissions.filter((p) => assignable.includes(p)));
      await list.refetch();
      setSuccess(`Permissions saved for ${current.name || current.email}`);
    } catch (e: unknown) {
      setError(errMsg(e, "Could not save permissions"));
    } finally {
      setSaving(false);
    }
  }

  const addReady =
    addForm.name.trim().length >= 2 &&
    !!addForm.email.trim() &&
    addForm.phone.trim().length >= 10 &&
    addForm.password.length >= 8;

  async function createAdmin() {
    if (!addReady || adding) return;
    setAdding(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiClient.api<{ id: string }>("/admin/admins", {
        method: "POST",
        body: JSON.stringify({
          name: addForm.name.trim(),
          email: addForm.email.trim(),
          phone: addForm.phone.trim(),
          password: addForm.password,
        }),
      });
      setAddOpen(false);
      setAddForm({ name: "", email: "", phone: "", password: "" });
      await list.refetch();
      if (res?.id) {
        setSelected(res.id);
        setPerms([]);
      }
      setSuccess("Admin account created. Choose their permissions next.");
    } catch (e: unknown) {
      Alert.alert("Could not create admin", errMsg(e));
    } finally {
      setAdding(false);
    }
  }

  const pwMismatch = pwConfirm.length > 0 && pwConfirm !== pw;
  const pwReady = pw.length >= 8 && pw === pwConfirm;

  function openPassword(row: AdminRow) {
    setPw("");
    setPwConfirm("");
    setPwFor(row);
  }

  async function changePassword() {
    if (!pwFor || !pwReady || pwSaving) return;
    setPwSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.api(`/admin/admins/${pwFor.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ new_password: pw }),
      });
      setPwFor(null);
      setPw("");
      setPwConfirm("");
      setSuccess("Password changed");
    } catch (e: unknown) {
      Alert.alert("Could not change password", errMsg(e));
    } finally {
      setPwSaving(false);
    }
  }

  function confirmStatus(row: AdminRow) {
    const disable = !row.blocked;
    Alert.alert(
      `${disable ? "Disable" : "Enable"} ${row.name || "this admin"}?`,
      disable
        ? "They will lose access immediately, including any session already open. You can enable them again later."
        : "They will be able to sign in again with their existing permissions.",
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: disable ? "Disable Admin" : "Enable Admin",
          style: disable ? "destructive" : "default",
          onPress: async () => {
            setError(null);
            setSuccess(null);
            try {
              await apiClient.api(`/admin/admins/${row.id}/status`, {
                method: "PUT",
                body: JSON.stringify({ disabled: disable }),
              });
              await list.refetch();
              setSuccess(disable ? "Admin disabled. Their access ended immediately." : "Admin enabled");
            } catch (e: unknown) {
              setError(errMsg(e));
            }
          },
        },
      ]
    );
  }

  const loadError = list.error || catalogQuery.error;

  return (
    <Screen>
      <ScreenHeader title={t("admin.permissions")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error || (loadError ? errMsg(loadError, "Failed to load admins") : null)} />
        <SuccessBanner message={success} />
        <AppText variant="small" color={colors.mutedForeground}>
          Choose what each Admin can see and do. Changes apply on the Admin&apos;s next page load.
        </AppText>
        {user?.role !== "super_admin" ? (
          <AppText variant="small">Super Admin accounts always have every permission. This page is enforced by the backend.</AppText>
        ) : null}
        <PrimaryButton
          title="Add Admin"
          onPress={() => {
            setAddForm({ name: "", email: "", phone: "", password: "" });
            setAddOpen(true);
          }}
        />
        <Field label="Search Admins" value={query} onChangeText={setQuery} placeholder="Name, email or phone" />
        <AppText variant="small" color={colors.mutedForeground}>
          {visibleRows.length} account{visibleRows.length === 1 ? "" : "s"}
        </AppText>
        {list.isLoading ? <LoadingBlock /> : null}
        {!list.isLoading && visibleRows.length === 0 && q ? (
          <AppText variant="small" color={colors.mutedForeground}>
            No admins match “{query}”.
          </AppText>
        ) : null}
        {visibleRows.map((a) => {
          const rowSuper = a.role === "super_admin";
          const badge = rowSuper
            ? "Super Admin"
            : a.blocked
              ? "Disabled"
              : `${(a.permissions || []).filter((p) => assignable.includes(p)).length} perms`;
          return (
            <Pressable key={a.id} onPress={() => requestSelect(a)}>
              <Card style={{ borderColor: selected === a.id ? colors.primary : colors.border, borderWidth: selected === a.id ? 2 : 0.5 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <AppText variant="h3" style={{ flex: 1 }}>
                    {a.name || "Unnamed admin"}
                  </AppText>
                  <AppText variant="small" color={a.blocked && !rowSuper ? colors.destructive : colors.mutedForeground}>
                    {badge}
                  </AppText>
                </View>
                <AppText variant="small">{a.email || a.phone || "—"}</AppText>
              </Card>
            </Pressable>
          );
        })}
        {current ? (
          <Card style={{ gap: 10 }}>
            <AppText variant="h3">{current.name || "Unnamed admin"}</AppText>
            <AppText variant="small" color={colors.mutedForeground}>
              {current.email || current.phone}
            </AppText>
            {isSuper ? (
              <AppText>
                Super Admins have unrestricted access to every module, including finance and reporting. Their access isn&apos;t
                configured here.
              </AppText>
            ) : (
              <>
                <AppText variant="small">
                  {perms.length} of {assignable.length} permissions
                </AppText>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Select All" variant="outline" disabled={saving} onPress={() => setPerms([...assignable])} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Clear All" variant="outline" disabled={saving} onPress={() => setPerms([])} />
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Change Password" variant="outline" onPress={() => openPassword(current)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title={current.blocked ? "Enable" : "Disable"}
                      variant={current.blocked ? "primary" : "ghost"}
                      onPress={() => confirmStatus(current)}
                    />
                  </View>
                </View>
                {catalogQuery.isLoading ? <LoadingBlock /> : null}
                {groups.map((g) => {
                  const keys = g.permissions.map((p) => p.key);
                  const on = keys.filter((k) => perms.includes(k)).length;
                  return (
                    <Card key={g.key} compact style={{ gap: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 4 }}>
                        <AppText variant="h3" style={{ flex: 1 }}>
                          {g.label}
                        </AppText>
                        <AppText variant="small" color={colors.mutedForeground}>
                          {on}/{keys.length}
                        </AppText>
                        <Switch
                          value={on === keys.length && keys.length > 0}
                          disabled={saving}
                          accessibilityLabel={`Select All ${g.label} Permissions`}
                          onValueChange={(v) => setGroup(keys, v)}
                        />
                      </View>
                      {g.permissions.map((p) => (
                        <View key={p.key} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 }}>
                          <AppText style={{ flex: 1 }}>{p.label}</AppText>
                          <Switch value={perms.includes(p.key)} disabled={saving} onValueChange={(v) => toggle(p.key, v)} />
                        </View>
                      ))}
                    </Card>
                  );
                })}
                <Card compact style={{ gap: 4, borderStyle: "dashed" }}>
                  <AppText variant="h3">Super Admin only (not assignable)</AppText>
                  {SUPER_ONLY_CAPABILITIES.map((c) => (
                    <AppText key={c} variant="small" color={colors.mutedForeground}>
                      • {c}
                    </AppText>
                  ))}
                </Card>
                <AppText variant="small" color={dirty ? colors.primary : colors.mutedForeground}>
                  {dirty ? "You have unsaved changes" : "All changes saved"}
                </AppText>
                <PrimaryButton title="Reset" variant="ghost" disabled={!dirty || saving} onPress={() => setPerms(saved)} />
                <PrimaryButton title={t("admin.save")} loading={saving} disabled={!dirty} onPress={() => void save()} />
              </>
            )}
            {user?.role === "super_admin" && !isSuper ? (
              <PrimaryButton
                title="Promote to Super Admin"
                variant="outline"
                onPress={() => {
                  Alert.alert(
                    "Promote to Super Admin",
                    `This cannot be undone from the app. Promote ${current.email || current.name}?`,
                    [
                      { text: t("common.cancel"), style: "cancel" },
                      {
                        text: "Promote",
                        style: "destructive",
                        onPress: async () => {
                          setError(null);
                          try {
                            await apiClient.api(`/admin/users/${current.id}/promote-super`, { method: "POST" });
                            await list.refetch();
                          } catch (e: unknown) {
                            setError(errMsg(e));
                          }
                        },
                      },
                    ]
                  );
                }}
              />
            ) : null}
          </Card>
        ) : null}
      </ScrollView>

      <AdminFormModal
        visible={addOpen}
        title="Add Admin"
        onClose={() => setAddOpen(false)}
        submitLabel={adding ? "Creating…" : "Create Admin"}
        onSubmit={() => void createAdmin()}
        loading={adding}
        disabled={!addReady}
      >
        <Field label="Full Name" value={addForm.name} onChangeText={(name) => setAddForm((f) => ({ ...f, name }))} />
        <Field
          label="Email"
          value={addForm.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="off"
          onChangeText={(email) => setAddForm((f) => ({ ...f, email }))}
        />
        <Field
          label="Mobile Number"
          value={addForm.phone}
          keyboardType="phone-pad"
          maxLength={15}
          onChangeText={(phone) => setAddForm((f) => ({ ...f, phone }))}
        />
        <Field
          label="Password"
          value={addForm.password}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          onChangeText={(password) => setAddForm((f) => ({ ...f, password }))}
        />
        <AppText variant="small" color={colors.mutedForeground}>
          New admins start with no permissions. Choose them after creating the account.
        </AppText>
      </AdminFormModal>

      <AdminFormModal
        visible={!!pwFor}
        title="Change Password"
        onClose={() => setPwFor(null)}
        submitLabel={pwSaving ? "Saving…" : "Change Password"}
        onSubmit={() => void changePassword()}
        loading={pwSaving}
        disabled={!pwReady}
      >
        <AppText variant="small" color={colors.mutedForeground}>
          For {pwFor?.name || pwFor?.email}. They will be signed out everywhere and must use the new password.
        </AppText>
        <Field
          label="New Password"
          value={pw}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          onChangeText={setPw}
        />
        <Field
          label="Confirm New Password"
          value={pwConfirm}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          placeholder="Type it again"
          onChangeText={setPwConfirm}
          error={pwMismatch ? "Passwords do not match" : null}
        />
      </AdminFormModal>
    </Screen>
  );
}
