import type { LegalPolicy } from "@bseva/types";
import { spacing } from "@bseva/tokens";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { AppText, Card, ErrorBanner, LoadingBlock } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

const TERMS_SLUGS = ["platform_terms", "booking_terms", "cancellation_policy"] as const;

const SECTION_LABEL_KEYS: Record<string, string> = {
  platform_terms: "legal.section.platform",
  booking_terms: "legal.section.booking",
  cancellation_policy: "legal.section.cancellation",
};

const SECTION_BAR_HEIGHT = 40;

function orderPolicies(rows: LegalPolicy[]): LegalPolicy[] {
  return TERMS_SLUGS.map((slug) => rows.find((p) => p.slug === slug)).filter(Boolean) as LegalPolicy[];
}

function TermsSectionBar({
  policies,
  selectedSlug,
  onSelect,
}: {
  policies: LegalPolicy[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const { t } = useI18n();
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        height: SECTION_BAR_HEIGHT,
        flexGrow: 0,
        flexShrink: 0,
        marginBottom: spacing.md,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ height: SECTION_BAR_HEIGHT, flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{
          flexDirection: "row",
          alignItems: "stretch",
          gap: spacing.md,
          height: SECTION_BAR_HEIGHT,
        }}
      >
        {policies.map((policy) => {
          const active = selectedSlug === policy.slug;
          const labelKey = SECTION_LABEL_KEYS[policy.slug];
          const label = labelKey ? t(labelKey) : policy.title;
          return (
            <Pressable
              key={policy.slug}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(policy.slug)}
              style={{
                justifyContent: "center",
                paddingHorizontal: 2,
                paddingTop: 2,
                borderBottomWidth: active ? 2 : 0,
                borderBottomColor: active ? colors.primary : "transparent",
                backgroundColor: active ? `${colors.primary}0D` : "transparent",
              }}
            >
              <AppText
                numberOfLines={1}
                style={{
                  fontWeight: active ? "700" : "500",
                  fontSize: 14,
                  lineHeight: 18,
                }}
                color={active ? colors.navy : colors.mutedForeground}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
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

  const selected = policies.find((p) => p.slug === selectedSlug) || policies[0];

  if (q.isLoading) return <LoadingBlock />;

  return (
    <>
      {q.error ? (
        <ErrorBanner message={q.error instanceof Error ? q.error.message : t("errors.generic")} />
      ) : null}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 40,
          gap: spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {policies.length ? (
          <TermsSectionBar
            policies={policies}
            selectedSlug={selectedSlug}
            onSelect={setSelectedSlug}
          />
        ) : null}

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
