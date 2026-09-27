import type { LegalPolicy } from "@bseva/types";
import { radius, spacing } from "@bseva/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { AppText, Card, ErrorBanner, LoadingBlock } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

const TERMS_SLUGS = ["platform_terms", "booking_terms", "cancellation_policy"] as const;

const SECTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  platform_terms: "scale-outline",
  booking_terms: "document-text-outline",
  cancellation_policy: "close-circle-outline",
};

function orderPolicies(rows: LegalPolicy[]): LegalPolicy[] {
  return TERMS_SLUGS.map((slug) => rows.find((p) => p.slug === slug)).filter(Boolean) as LegalPolicy[];
}

function TermsCategoryCard({
  policy,
  active,
  onPress,
}: {
  policy: LegalPolicy;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const icon = SECTION_ICONS[policy.slug] || "document-text-outline";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        width: "100%",
        borderRadius: radius.lg,
        borderWidth: active ? 2 : 1,
        borderColor: active ? colors.primary : `${colors.border}CC`,
        backgroundColor: active ? `${colors.primary}14` : colors.white,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active ? colors.primary : colors.secondary,
          flexShrink: 0,
        }}
      >
        <Ionicons name={icon} size={20} color={active ? colors.white : colors.navy} />
      </View>
      <AppText
        style={{
          flex: 1,
          fontSize: 14,
          lineHeight: 20,
          fontWeight: active ? "700" : "600",
        }}
        color={active ? colors.navy : colors.mutedForeground}
      >
        {policy.title}
      </AppText>
    </Pressable>
  );
}

export function TermsScreenContent() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["legal", "terms-sections"],
    queryFn: () => apiClient.legal() as Promise<LegalPolicy[]>,
  });

  const policies = useMemo(() => orderPolicies(Array.isArray(q.data) ? q.data : []), [q.data]);

  useEffect(() => {
    if (!policies.length) return;
    setSelectedSlug((prev) => prev || policies[0].slug);
  }, [policies]);

  const selected =
    policies.find((p) => p.slug === selectedSlug) || policies[0];

  if (q.isLoading) return <LoadingBlock />;

  return (
    <>
      {q.error ? (
        <ErrorBanner message={q.error instanceof Error ? q.error.message : t("errors.generic")} />
      ) : null}
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}>
        <AppText variant="small" color={colors.mutedForeground}>
          {t("web.legal.chooseSection")}
        </AppText>

        <View style={{ gap: spacing.sm }}>
          {policies.map((policy) => (
            <TermsCategoryCard
              key={policy.slug}
              policy={policy}
              active={selectedSlug === policy.slug}
              onPress={() => setSelectedSlug(policy.slug)}
            />
          ))}
        </View>

        {selected ? (
          <View style={{ gap: spacing.md }}>
            <View>
              <AppText variant="h2">{selected.title}</AppText>
              {selected.version ? (
                <AppText variant="small" color={colors.mutedForeground} style={{ marginTop: 4 }}>
                  {t("common.version", { version: selected.version })}
                </AppText>
              ) : null}
            </View>
            {(selected.points || []).map((point, i) => (
              <Card key={`${point.title || "section"}-${i}`} style={{ gap: 6 }}>
                {point.title ? <AppText variant="h3">{point.title}</AppText> : null}
                <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
                  {point.body}
                </AppText>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
