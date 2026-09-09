import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useState } from "react";

export default function PujariServicesLevel() {
  const { colors } = useAppTheme();
  const profile = useQuery({ queryKey: ["pujari-profile"], queryFn: () => apiClient.getPujariProfile() });
  const roles = useQuery({ queryKey: ["pujari-roles"], queryFn: () => apiClient.pujariRoles() as Promise<{ level: number; title: string; summary?: string }[]> });
  const approved = Number(profile.data?.approved_level || 0);
  const [level, setLevel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = Array.isArray(roles.data) ? roles.data : [];
  return (
    <Screen>
      <ScreenHeader title="Upgrade role" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        <ErrorBanner message={error} />
        <AppText>Approved level: {approved || "—"}</AppText>
        <AppText>Requested: {String(profile.data?.requested_level || "—")}</AppText>
        {rows.map((r) => (
          <Pressable key={r.level} onPress={() => r.level > approved && setLevel(r.level)}>
            <Card style={{ borderWidth: level === r.level ? 2 : 0.5, borderColor: level === r.level ? colors.primary : colors.border }}>
              <AppText variant="h3">
                Level {r.level}: {r.title}
              </AppText>
              <AppText variant="small">{r.summary}</AppText>
              {r.level <= approved ? <AppText variant="small">Already at or below this level</AppText> : null}
            </Card>
          </Pressable>
        ))}
        <PrimaryButton
          title="Request selected level"
          onPress={async () => {
            if (!level) {
              setError("Select a higher level");
              return;
            }
            setError(null);
            try {
              await apiClient.applyPujariLevel(level);
              await profile.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed");
            }
          }}
        />
      </ScrollView>
    </Screen>
  );
}
