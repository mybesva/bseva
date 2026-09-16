import type { LegalPolicy } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, LoadingBlock, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function AdminLegal() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const [slug, setSlug] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["admin-legal"],
    queryFn: () => apiClient.api<LegalPolicy[]>("/admin/legal"),
  });
  const rows = Array.isArray(list.data) ? list.data : [];
  const selected = rows.find((p) => p.slug === slug) || rows[0];
  return (
    <Screen>
      <ScreenHeader title={t("admin.legal")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        {list.isLoading ? <LoadingBlock /> : null}
        {rows.map((p) => (
          <Pressable key={p.slug} onPress={() => setSlug(p.slug)}>
            <Card style={{ borderColor: selected?.slug === p.slug ? colors.primary : colors.border, borderWidth: selected?.slug === p.slug ? 2 : 0.5 }}>
              <AppText variant="h3">{p.title}</AppText>
              <AppText variant="small">{p.slug} · {p.version}</AppText>
            </Card>
          </Pressable>
        ))}
        {(selected?.points || []).map((pt, i) => (
          <Card key={`${selected?.slug}-${i}`}>
            {pt.title ? <AppText variant="h3">{pt.title}</AppText> : null}
            <AppText>{pt.body}</AppText>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
