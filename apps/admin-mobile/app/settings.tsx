import { filterPujariRoles, validateGstPercent } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, ScrollView, Switch } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, SuccessBanner } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

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
      <AppText variant="h3">Pujari roles / levels</AppText>
      <Field
        label="Search roles or levels"
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
                <Field label="Examples (one per line)" value={editExamplesText} onChangeText={setEditExamplesText} multiline />
                <PrimaryButton title="Update role" loading={saving} onPress={() => void saveEdit(role.id)} />
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
                {role.can_delete !== false ? (
                  <PrimaryButton
                    title="Delete"
                    variant="ghost"
                    onPress={() =>
                      Alert.alert("Delete role?", `Level ${role.level} — ${role.title}`, [
                        { text: "Cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () =>
                            void apiClient
                              .api(`/admin/pujari-roles/${role.id}`, { method: "DELETE" })
                              .then(() => roles.refetch())
                              .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed")),
                        },
                      ])
                    }
                  />
                ) : null}
              </>
            )}
          </Card>
        );
      })}
      <AppText variant="h3">Add role</AppText>
      <Field label="Title" value={addTitle} onChangeText={setAddTitle} />
      <Field label="Summary" value={addSummary} onChangeText={setAddSummary} />
      <Field label="Examples (one per line)" value={addExamplesText} onChangeText={setAddExamplesText} multiline />
      <PrimaryButton title="Add role" loading={saving && !editingId} onPress={() => void saveNew()} />
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
          <Field label="GST percent" value={gst} onChangeText={setGst} keyboardType="decimal-pad" />
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
        <Field label="Search platform settings" value={filter} onChangeText={setFilter} placeholder="Filter config keys…" />
        <PujariRolesCard setError={setError} setSuccess={setSuccess} />
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
