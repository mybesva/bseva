import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScrollView, Switch } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

function stringify(v: unknown) {
  if (v == null) return "";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
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
        {pricing.isLoading || config.isLoading ? <LoadingBlock /> : null}
        <Card>
          <AppText variant="h3">GST %</AppText>
          <Field label="GST percent" value={gst} onChangeText={setGst} keyboardType="decimal-pad" />
          <PrimaryButton
            title={t("admin.save")}
            onPress={async () => {
              setError(null);
              try {
                await apiClient.api("/admin/pricing", { method: "PUT", body: JSON.stringify({ gst_percent: Number(gst) }) });
                await pricing.refetch();
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Failed");
              }
            }}
          />
        </Card>
        <Field label={t("admin.search")} value={filter} onChangeText={setFilter} />
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
