import { appTerms, customerTerms, privacyPolicy, pujariTerms, refundPolicy, type LegalDoc } from "@bseva/config";
import { spacing } from "@bseva/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { AppText, Card } from "@/components/ui";
import { isPujariApp } from "@/config/appVariant";
import { useAppTheme } from "@/theme/ThemeContext";

/**
 * Profile → Terms & Policies. Shows the same documents (same text, version and effective date) as the
 * website legal pages, from the shared @bseva/config/legal source, so app review sees one consistent policy set.
 */
const DOCS: { doc: LegalDoc; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    doc: isPujariApp ? pujariTerms : customerTerms,
    label: isPujariApp ? "Pujari Terms" : "Customer Terms",
    icon: "document-text-outline",
  },
  { doc: privacyPolicy, label: "Privacy", icon: "shield-checkmark-outline" },
  { doc: refundPolicy, label: "Refunds", icon: "refresh-circle-outline" },
  { doc: appTerms, label: "App Terms", icon: "phone-portrait-outline" },
];

/** Second-level switcher under the profile tabs: soft card, two segments per row. */
function DocBar({ selected, onSelect }: { selected: string; onSelect: (slug: string) => void }) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
        padding: 4,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: `${colors.border}66`,
        backgroundColor: colors.card,
      }}
    >
      {DOCS.map(({ doc, label, icon }) => {
        const active = selected === doc.slug;
        return (
          <Pressable
            key={doc.slug}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={doc.title}
            onPress={() => onSelect(doc.slug)}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: "45%",
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
            <Ionicons name={icon} size={16} color={active ? colors.primary : colors.mutedForeground} />
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

/** A legal table (first row = header) as stacked label/value rows, readable on a phone. */
function DocTable({ rows }: { rows: string[][] }) {
  const { colors } = useAppTheme();
  const [header, ...body] = rows;
  return (
    <View style={{ gap: 8 }}>
      {body.map((row, i) => (
        <View key={i} style={{ gap: 2, paddingTop: i ? 8 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: `${colors.border}66` }}>
          {row.map((cell, j) => (
            <AppText
              key={j}
              variant={j === 0 ? undefined : "small"}
              style={j === 0 ? { fontWeight: "700" } : { lineHeight: 20 }}
              color={j === 0 ? colors.foreground : colors.mutedForeground}
            >
              {j > 0 && header?.[j] && row.length > 2 ? `${header[j]}: ${cell}` : cell}
            </AppText>
          ))}
        </View>
      ))}
    </View>
  );
}

export function TermsScreenContent() {
  const { colors } = useAppTheme();
  const [selectedSlug, setSelectedSlug] = useState(DOCS[0].doc.slug);
  const doc = DOCS.find((d) => d.doc.slug === selectedSlug)?.doc || DOCS[0].doc;

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 40, gap: spacing.md }}
      keyboardShouldPersistTaps="handled"
    >
      <DocBar selected={doc.slug} onSelect={setSelectedSlug} />
      <View style={{ gap: spacing.md }}>
        <View>
          <AppText variant="h2">{doc.title}</AppText>
          <AppText variant="small" color={colors.mutedForeground} style={{ marginTop: 4 }}>
            Version {doc.version} · Effective {doc.effectiveDate}
          </AppText>
        </View>
        {(doc.intro || []).map((p, i) => (
          <AppText key={`intro-${i}`} color={colors.mutedForeground} style={{ lineHeight: 22 }}>
            {p}
          </AppText>
        ))}
        {doc.sections.map((section) => (
          <Card key={section.id} style={{ gap: 6 }}>
            <AppText variant="h3">{section.heading}</AppText>
            {(section.paragraphs || []).map((p, i) => (
              <AppText key={`p-${i}`} color={colors.mutedForeground} style={{ lineHeight: 22 }}>
                {p}
              </AppText>
            ))}
            {(section.bullets || []).map((b, i) => (
              <AppText key={`b-${i}`} color={colors.mutedForeground} style={{ lineHeight: 22 }}>
                • {b}
              </AppText>
            ))}
            {section.table?.length ? <DocTable rows={section.table} /> : null}
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
