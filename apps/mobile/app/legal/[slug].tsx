import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, LoadingBlock, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import type { LegalPolicy } from "@bseva/types";

export default function LegalScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useQuery({
    queryKey: ["legal", slug],
    queryFn: () => apiClient.legal(slug) as Promise<LegalPolicy>,
    enabled: !!slug,
  });
  const policy = q.data;
  return (
    <Screen>
      <ScreenHeader title={policy?.title || "Legal"} back />
      {q.isLoading ? <LoadingBlock /> : null}
      {q.error ? <ErrorBanner message={q.error instanceof Error ? q.error.message : "Could not load"} /> : null}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        {(policy?.points || []).map((p, i) => (
          <Card key={`${p.title || i}`}>
            {p.title ? <AppText variant="h3">{p.title}</AppText> : null}
            <AppText style={{ marginTop: 6 }}>{p.body}</AppText>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
