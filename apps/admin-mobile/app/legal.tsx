import type { LegalPolicy } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type Point = { title?: string; body: string };

export default function AdminLegal() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const [slug, setSlug] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [points, setPoints] = useState<Point[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useQuery({
    queryKey: ["admin-legal"],
    queryFn: () => apiClient.api<LegalPolicy[]>("/admin/legal"),
  });
  const rows = Array.isArray(list.data) ? list.data : [];
  const selected = rows.find((p) => p.slug === slug) || rows[0];

  useEffect(() => {
    if (!selected) return;
    setSlug(selected.slug);
    setTitle(selected.title || "");
    setVersion(selected.version || "");
    setPoints((selected.points || []).map((p) => ({ title: p.title || "", body: p.body || "" })));
  }, [selected?.slug, list.data]);

  return (
    <Screen>
      <ScreenHeader title={t("admin.legal")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        {list.isLoading ? <LoadingBlock /> : null}
        {rows.map((p) => (
          <Pressable key={p.slug} onPress={() => setSlug(p.slug)}>
            <Card style={{ borderColor: selected?.slug === p.slug ? colors.primary : colors.border, borderWidth: selected?.slug === p.slug ? 2 : 0.5 }}>
              <AppText variant="h3">{p.title}</AppText>
              <AppText variant="small">{p.slug} · {p.version}</AppText>
            </Card>
          </Pressable>
        ))}
        {selected ? (
          <>
            <Field label="Title" value={title} onChangeText={setTitle} />
            <Field label="Version" value={version} onChangeText={setVersion} />
            {points.map((pt, i) => (
              <Card key={`${selected.slug}-${i}`} style={{ gap: 8 }}>
                <Field
                  label={`Point ${i + 1} title`}
                  value={pt.title || ""}
                  onChangeText={(v) => setPoints((prev) => prev.map((p, idx) => (idx === i ? { ...p, title: v } : p)))}
                />
                <Field
                  label="Body"
                  value={pt.body}
                  onChangeText={(v) => setPoints((prev) => prev.map((p, idx) => (idx === i ? { ...p, body: v } : p)))}
                  multiline
                />
              </Card>
            ))}
            <PrimaryButton title="Add point" variant="outline" onPress={() => setPoints((prev) => [...prev, { title: "", body: "" }])} />
            <PrimaryButton
              title={busy ? t("mobile.saving") : t("admin.save")}
              loading={busy}
              onPress={async () => {
                setBusy(true);
                setError(null);
                try {
                  await apiClient.api(`/admin/legal/${selected.slug}`, {
                    method: "PUT",
                    body: JSON.stringify({ title, version, points: points.filter((p) => p.body.trim()) }),
                  });
                  await list.refetch();
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Save failed");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
