import { filterPujariRoles, validateGstPercent } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, ScrollView, Switch, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, SuccessBanner } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

function stringify(v: unknown) {
  if (v == null) return "";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

type RoleRow = { id: string; level?: number; title?: string; summary?: string; examples?: string[]; can_delete?: boolean };

function PujariRolesCard({
  setError,
  setSuccess,
}: {
  setError: (v: string | null) => void;
  setSuccess: (v: string | null) => void;
}) {
  const { colors } = useAppTheme();
  const roles = useQuery({
    queryKey: ["admin-pujari-roles"],
    queryFn: () => apiClient.api<RoleRow[] | { items?: RoleRow[] }>("/admin/pujari-roles"),
  });
  const allRows = Array.isArray(roles.data) ? roles.data : roles.data?.items || [];
  const [roleSearch, setRoleSearch] = useState("");
  const rows = useMemo(() => filterPujariRoles(allRows, roleSearch), [allRows, roleSearch]);
  const [addTitle, setAddTitle] = useState("");
  const [addSummary, setAddSummary] = useState("");
  const [addExamplesText, setAddExamplesText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editExamplesText, setEditExamplesText] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveNew() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const examples = addExamplesText.split("\n").map((l) => l.trim()).filter(Boolean);
    const payload = { title: addTitle.trim(), summary: addSummary.trim() || null, examples };
    if (!payload.title) {
      setError("Title is required.");
      setSaving(false);
      return;
    }
    try {
      await apiClient.api("/admin/pujari-roles", { method: "POST", body: JSON.stringify(payload) });
      setAddTitle("");
      setAddSummary("");
      setAddExamplesText("");
      setSuccess("Role added successfully.");
      await roles.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(roleId: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const examples = editExamplesText.split("\n").map((l) => l.trim()).filter(Boolean);
    const payload = { title: editTitle.trim(), summary: editSummary.trim() || null, examples };
    if (!payload.title) {
      setError("Title is required.");
      setSaving(false);
      return;
    }
    try {
      await apiClient.api(`/admin/pujari-roles/${roleId}`, { method: "PUT", body: JSON.stringify(payload) });
      setEditingId(null);
      setSuccess("Role updated successfully.");
      await roles.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ gap: 8 }}>
      <AppText variant="h3">Pujari Roles / Levels</AppText>
      <Field
        label="Search Roles or Levels"
        placeholder="Search roles or levels…"
        value={roleSearch}
        onChangeText={setRoleSearch}
      />
      {roles.isLoading ? <LoadingBlock /> : null}
      {rows.map((role) => {
        const editing = editingId === role.id;
        return (
          <Card key={role.id} style={{ gap: 8 }}>
            {editing ? (
              <>
                <AppText variant="h3">Edit level {role.level}</AppText>
                <Field label="Title" value={editTitle} onChangeText={setEditTitle} />
                <Field label="Summary" value={editSummary} onChangeText={setEditSummary} />
                <Field label="Examples (One per Line)" value={editExamplesText} onChangeText={setEditExamplesText} multiline />
                <PrimaryButton title="Update Role" loading={saving} onPress={() => void saveEdit(role.id)} />
                <PrimaryButton
                  title="Cancel"
                  variant="ghost"
                  onPress={() => {
                    setEditingId(null);
                  }}
                />
              </>
            ) : (
              <>
                <AppText variant="h3">Level {role.level} · {role.title}</AppText>
                <AppText variant="small">{role.summary}</AppText>
                <PrimaryButton
                  title="Edit"
                  variant="outline"
                  onPress={() => {
                    setEditingId(role.id);
                    setEditTitle(role.title || "");
                    setEditSummary(role.summary || "");
                    setEditExamplesText((role.examples || []).join("\n"));
                  }}
                />
                <PrimaryButton
                  title="Delete"
                  variant="ghost"
                  disabled={role.can_delete === false}
                  onPress={() =>
                    Alert.alert("Delete role?", `Delete Level ${role.level} — ${role.title}?`, [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          setError(null);
                          setSuccess(null);
                          void apiClient
                            .api(`/admin/pujari-roles/${role.id}`, { method: "DELETE" })
                            .then(async () => {
                              setSuccess("Role deleted");
                              await roles.refetch();
                            })
                            .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed"));
                        },
                      },
                    ])
                  }
                />
                {role.can_delete === false ? (
                  <AppText variant="small" color={colors.mutedForeground}>
                    Cannot delete — pujaris or services still use this level
                  </AppText>
                ) : null}
              </>
            )}
          </Card>
        );
      })}
      <AppText variant="h3">Add Role</AppText>
      <Field label="Title" value={addTitle} onChangeText={setAddTitle} />
      <Field label="Summary" value={addSummary} onChangeText={setAddSummary} />
      <Field label="Examples (One per Line)" value={addExamplesText} onChangeText={setAddExamplesText} multiline />
      <PrimaryButton title="Add Role" loading={saving && !editingId} onPress={() => void saveNew()} />
    </Card>
  );
}

type CaptchaMandatory = { feature: string; label: string; enabled: true; locked: true };
type CaptchaConfigurable = {
  feature: string;
  label: string;
  enabled: boolean;
  updated_by_name: string | null;
  updated_at: string | null;
};
type CaptchaView = {
  mandatory: CaptchaMandatory[];
  configurable: CaptchaConfigurable[];
  enforcement_active: boolean;
  history: { actor_name: string; reason: string; created_at: string }[];
};

function captchaWhen(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

/** Super Admin only. Contact Us and Custom Puja are always on; the four switches are saved on the server. */
function CaptchaSettingsCard({
  setError,
  setSuccess,
}: {
  setError: (v: string | null) => void;
  setSuccess: (v: string | null) => void;
}) {
  const { colors } = useAppTheme();
  const [saving, setSaving] = useState<string | null>(null);
  const captcha = useQuery({
    queryKey: ["admin-security-captcha"],
    queryFn: () => apiClient.api<CaptchaView>("/admin/security/captcha"),
  });
  const view = captcha.data;

  async function toggle(item: CaptchaConfigurable, enabled: boolean) {
    setSaving(item.feature);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.api<CaptchaView>(`/admin/security/captcha/${item.feature}`, {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      });
      await captcha.refetch();
      setSuccess(`${item.label} CAPTCHA turned ${enabled ? "on" : "off"}.`);
    } catch (e: unknown) {
      setError(e instanceof Error && e.message ? e.message : "Could not save the setting");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card style={{ gap: 10 }}>
      <AppText variant="h3">CAPTCHA Settings</AppText>
      <AppText variant="small" color={colors.mutedForeground}>
        The 5-character security image shown to people who are not signed in. Applies to the website and the Customer and
        Pujari apps.
      </AppText>
      {captcha.error ? (
        <ErrorBanner message={captcha.error instanceof Error ? captcha.error.message : "Could not load CAPTCHA settings"} />
      ) : null}
      {captcha.isLoading ? <LoadingBlock /> : null}
      {view ? (
        <>
          {!view.enforcement_active ? (
            <Card compact style={{ borderColor: colors.primary }}>
              <AppText variant="small">
                Registration and sign-in switches are saved but not enforced yet. They start working once the updated mobile
                apps are released and enforcement is turned on for this server. Contact Us and Custom Puja are enforced now.
              </AppText>
            </Card>
          ) : null}
          <AppText variant="h3">Always on</AppText>
          {view.mandatory.map((item) => (
            <View key={item.feature} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AppText style={{ flex: 1 }}>{item.label}</AppText>
              <AppText variant="small" color={colors.mutedForeground}>
                Always Enabled
              </AppText>
            </View>
          ))}
          <AppText variant="small" color={colors.mutedForeground}>
            Required for visitors who are not signed in and cannot be turned off. Signed-in customers and pujaris are not asked.
          </AppText>
          <AppText variant="h3">Registration and sign-in</AppText>
          {view.configurable.map((item) => (
            <View key={item.feature} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <AppText>{item.label}</AppText>
                <AppText variant="small" color={colors.mutedForeground}>
                  {item.updated_by_name ? `Changed by ${item.updated_by_name}, ${captchaWhen(item.updated_at)}` : "Default (on)"}
                </AppText>
              </View>
              <AppText variant="small" color={colors.mutedForeground}>
                {item.enabled ? "On" : "Off"}
              </AppText>
              <Switch
                value={item.enabled}
                disabled={saving !== null}
                accessibilityLabel={`${item.label} CAPTCHA`}
                onValueChange={(on) => void toggle(item, on)}
              />
            </View>
          ))}
          <AppText variant="small" color={colors.mutedForeground}>
            Admin and Super Admin sign-in never shows a CAPTCHA.
          </AppText>
          {view.history.length > 0 ? (
            <>
              <AppText variant="h3">Recent changes</AppText>
              {view.history.slice(0, 10).map((row, i) => (
                <AppText key={i} variant="small" color={colors.mutedForeground}>
                  {row.reason.replace("->", "→")} by {row.actor_name}, {captchaWhen(row.created_at)}
                </AppText>
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

function parseValue(raw: string, original: unknown) {
  if (typeof original === "boolean") return raw === "true" || raw === "1";
  if (typeof original === "number") return Number(raw);
  if (original && typeof original === "object") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

export default function AdminSettings() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";
  const [gst, setGst] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const pricing = useQuery({
    queryKey: ["admin-pricing"],
    queryFn: async () => {
      const p = await apiClient.api<{ gst_percent?: number }>("/admin/pricing");
      setGst(String(p.gst_percent ?? ""));
      return p;
    },
  });
  const config = useQuery({
    queryKey: ["admin-config"],
    queryFn: async () => {
      const data = await apiClient.api<Record<string, unknown>>("/admin/config");
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(data || {})) next[k] = stringify(v);
      setDrafts(next);
      return data;
    },
  });
  const keys = useMemo(() => {
    const all = Object.keys(config.data || {}).sort();
    const f = filter.trim().toLowerCase();
    return f ? all.filter((k) => k.toLowerCase().includes(f)) : all;
  }, [config.data, filter]);

  return (
    <Screen>
      <ScreenHeader title={t("admin.settings")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <SuccessBanner message={success} />
        {pricing.isLoading || config.isLoading ? <LoadingBlock /> : null}
        <Card>
          <AppText variant="h3">GST %</AppText>
          <Field label="GST Percent" value={gst} onChangeText={setGst} keyboardType="decimal-pad" />
          <PrimaryButton
            title={t("admin.save")}
            onPress={async () => {
              setError(null);
              setSuccess(null);
              const gstError = validateGstPercent(gst);
              if (gstError) {
                setError(gstError);
                return;
              }
              try {
                await apiClient.api("/admin/pricing", { method: "PUT", body: JSON.stringify({ gst_percent: Number(gst) }) });
                await pricing.refetch();
                setSuccess("GST percentage updated successfully.");
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Failed to update GST.");
              }
            }}
          />
        </Card>
        <Field label="Search Platform Settings" value={filter} onChangeText={setFilter} placeholder="Filter config keys…" />
        <PujariRolesCard setError={setError} setSuccess={setSuccess} />
        {isSuper ? <CaptchaSettingsCard setError={setError} setSuccess={setSuccess} /> : null}
        {keys.map((k) => {
          const original = config.data?.[k];
          const isBool = typeof original === "boolean";
          return (
            <Card key={k} style={{ gap: 8 }}>
              <AppText variant="small">{k}</AppText>
              {isBool ? (
                <Switch
                  value={(drafts[k] ?? stringify(original)) === "true"}
                  onValueChange={(v) => setDrafts((d) => ({ ...d, [k]: String(v) }))}
                />
              ) : (
                <Field label={k} value={drafts[k] ?? ""} onChangeText={(v) => setDrafts((d) => ({ ...d, [k]: v }))} />
              )}
              <PrimaryButton
                title={saving === k ? t("admin.save") : t("admin.save")}
                loading={saving === k}
                variant="outline"
                onPress={async () => {
                  setSaving(k);
                  setError(null);
                  try {
                    await apiClient.api("/admin/config", {
                      method: "PUT",
                      body: JSON.stringify({ key: k, value: parseValue(drafts[k] ?? "", original) }),
                    });
                    await config.refetch();
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Failed");
                  } finally {
                    setSaving(null);
                  }
                }}
              />
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
