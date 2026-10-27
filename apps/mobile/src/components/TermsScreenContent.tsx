import type { LegalPolicy } from "@bseva/types";
import { spacing } from "@bseva/tokens";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
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

const SECTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  platform_terms: "document-text-outline",
  booking_terms: "calendar-outline",
  cancellation_policy: "refresh-circle-outline",
};

function orderPolicies(rows: LegalPolicy[]): LegalPolicy[] {
  return TERMS_SLUGS.map((slug) => rows.find((p) => p.slug === slug)).filter(Boolean) as LegalPolicy[];
}

/** Second-level switcher under the profile tabs: soft card with equal-width segments. */
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
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        gap: 4,
        padding: 4,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: `${colors.border}66`,
        backgroundColor: colors.card,
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
            accessibilityLabel={label}
            onPress={() => onSelect(policy.slug)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 44,
              paddingHorizontal: 6,
              paddingVertical: 8,
              borderRadius: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderWidth: 1,
              borderColor: active ? `${colors.primary}59` : "transparent",
              backgroundColor: active ? `${colors.primary}1A` : pressed ? `${colors.primary}0D` : "transparent",
            })}
          >
            <Ionicons
              name={SECTION_ICONS[policy.slug] || "document-outline"}
              size={16}
              color={active ? colors.primary : colors.mutedForeground}
            />
            <AppText
              numberOfLines={1}
              style={{ fontWeight: active ? "700" : "600", fontSize: 13, flexShrink: 1 }}
              color={active ? colors.navy : colors.mutedForeground}
            >
              {label}
            </AppText>
          </Pressable>
        );
      })}
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
