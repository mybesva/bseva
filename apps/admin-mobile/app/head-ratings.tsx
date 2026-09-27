import {
  filterHeadRatingHistory,
  resolveHeadRatingPujariName,
  validateHeadRatingSubmission,
  type HeadRatingPujari,
  type HeadRatingRecord,
  type HeadRatingSort,
} from "@bseva/config";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SearchablePujariSelect, SelectedPujariCard } from "@/components/SearchablePujariSelect";
import { StarRatingInput } from "@/components/StarRatingInput";
import {
  AppText,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  PrimaryButton,
  Screen,
  SuccessBanner,
} from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

function normalizeList<T>(data: T[] | { items?: T[] } | undefined): T[] {
  if (Array.isArray(data)) return data;
  return data?.items || [];
}

function HistoryStars({ stars, color }: { stars: number; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Ionicons
          key={i}
          name={i < stars ? "star" : "star-outline"}
          size={14}
          color={color}
        />
      ))}
    </View>
  );
}

export default function HeadRatings() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const [pujariId, setPujariId] = useState("");
  const [manualId, setManualId] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ pujari?: string; comments?: string }>({});
  const [historySearch, setHistorySearch] = useState("");
  const [starsFilter, setStarsFilter] = useState<number | "all">("all");
  const [historySort, setHistorySort] = useState<HeadRatingSort>("newest");

  const history = useQuery({
    queryKey: ["head-ratings"],
    queryFn: () => apiClient.headRatings() as Promise<HeadRatingRecord[]>,
  });
  const pujarisQuery = useQuery({
    queryKey: ["head-pujaris"],
    queryFn: () =>
      apiClient.api<HeadRatingPujari[] | { items?: HeadRatingPujari[] }>("/head/pujaris"),
  });

  const rows = normalizeList(history.data);
  const people: HeadRatingPujari[] = normalizeList(pujarisQuery.data).map((p) => ({
    id: String(p.id),
    name: String(p.name || "Pujari"),
    email: p.email ? String(p.email) : undefined,
    phone: p.phone ? String(p.phone) : undefined,
  }));
  const selectedPujari = people.find((p) => p.id === pujariId);

  const filteredHistory = useMemo(
    () => filterHeadRatingHistory(rows, { search: historySearch, starsFilter, sort: historySort }, people),
    [rows, historySearch, starsFilter, historySort, people],
  );

  async function submitRating() {
    if (submitting) return;
    setError(null);
    setSuccess(null);
    const validation = validateHeadRatingSubmission({ pujariId, manualId, stars, comments });
    if (!validation.ok) {
      if (validation.field === "pujari" || validation.field === "comments") {
        setFieldErrors({ [validation.field]: validation.message });
      } else {
        setError(validation.message);
      }
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await apiClient.submitHeadRating({
        pujari_id: validation.targetId,
        stars,
        comments: comments.trim(),
      });
      setSuccess("Rating saved");
      setComments("");
      setStars(5);
      setPujariId("");
      setManualId("");
      await history.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("admin.headRatings")} back />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <ErrorBanner message={error} />
          <SuccessBanner message={success} />

          <Card>
            <AppText variant="h3" style={{ marginBottom: 12 }}>
              Rate a Pujari
            </AppText>

            {selectedPujari ? (
              <View style={{ marginBottom: 12 }}>
                <SelectedPujariCard
                  pujari={selectedPujari}
                  onChange={() => {
                    setPujariId("");
                    setManualId("");
                  }}
                />
              </View>
            ) : (
              <View style={{ marginBottom: 12 }}>
                <SearchablePujariSelect
                  label="Select Pujari"
                  pujaris={people}
                  value={pujariId}
                  onChange={(id) => {
                    setPujariId(id);
                    setManualId("");
                    setFieldErrors((prev) => ({ ...prev, pujari: undefined }));
                  }}
                  loading={pujarisQuery.isLoading}
                  error={fieldErrors.pujari}
                />
              </View>
            )}

            <Pressable
              onPress={() => setAdvancedOpen((v) => !v)}
              accessibilityRole="button"
              style={{
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: colors.border,
                borderRadius: 10,
                padding: 12,
                marginBottom: advancedOpen ? 8 : 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <AppText variant="small" color={colors.mutedForeground}>
                Advanced / Enter identifier manually
              </AppText>
              <Ionicons
                name={advancedOpen ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
            {advancedOpen ? (
              <View style={{ marginBottom: 12 }}>
                <Field
                  label="UUID / email / phone"
                  value={manualId}
                  onChangeText={(text) => {
                    setManualId(text);
                    setPujariId("");
                    setFieldErrors((prev) => ({ ...prev, pujari: undefined }));
                  }}
                  placeholder="Do not use numeric IDs like 2"
                  autoCapitalize="none"
                />
              </View>
            ) : null}

            <View style={{ gap: 8, marginBottom: 12 }}>
              <AppText variant="small" style={{ fontWeight: "600", color: colors.mutedForeground }}>
                Rating
              </AppText>
              <StarRatingInput value={stars} onChange={setStars} disabled={submitting} />
            </View>

            <Field
              label="Comment *"
              value={comments}
              onChangeText={(text) => {
                setComments(text);
                setFieldErrors((prev) => ({ ...prev, comments: undefined }));
              }}
              placeholder="Add a comment about this pujari..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              error={fieldErrors.comments}
              style={{ minHeight: 110 }}
            />

            <View style={{ marginTop: 12 }}>
              <PrimaryButton
                title={submitting ? "Submitting..." : "Submit Rating"}
                onPress={submitRating}
                loading={submitting}
                disabled={submitting}
              />
            </View>
          </Card>

          <Card>
            <AppText variant="h3" style={{ marginBottom: 12 }}>
              Rating History
            </AppText>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                minHeight: 48,
                backgroundColor: colors.card,
                marginBottom: 12,
              }}
            >
              <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                value={historySearch}
                onChangeText={setHistorySearch}
                placeholder="Search history..."
                placeholderTextColor={colors.mutedForeground}
                style={{ flex: 1, color: colors.foreground, fontSize: 16, paddingVertical: 10 }}
              />
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <Pressable
                onPress={() => setStarsFilter("all")}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: starsFilter === "all" ? colors.primary : colors.secondary,
                }}
              >
                <AppText
                  variant="small"
                  color={starsFilter === "all" ? colors.primaryForeground : colors.foreground}
                  style={{ fontWeight: "600" }}
                >
                  All ratings
                </AppText>
              </Pressable>
              {[5, 4, 3, 2, 1].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setStarsFilter(n)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: starsFilter === n ? colors.primary : colors.secondary,
                  }}
                >
                  <AppText
                    variant="small"
                    color={starsFilter === n ? colors.primaryForeground : colors.foreground}
                    style={{ fontWeight: "600" }}
                  >
                    {n}★
                  </AppText>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setHistorySort((s) => (s === "newest" ? "oldest" : "newest"))}
              accessibilityRole="button"
              style={{ marginBottom: 12 }}
            >
              <AppText variant="small" color={colors.primary} style={{ fontWeight: "700" }}>
                Sort: {historySort === "newest" ? "Newest first" : "Oldest first"} ▼
              </AppText>
            </Pressable>

            {history.isLoading ? (
              <LoadingBlock />
            ) : filteredHistory.length === 0 ? (
              <EmptyState
                title={rows.length === 0 ? "No ratings yet." : "No matching ratings."}
                subtitle={
                  rows.length === 0
                    ? "Ratings submitted by Admin will appear here."
                    : "Try adjusting your search or filters."
                }
              />
            ) : (
              <View style={{ gap: 10 }}>
                {filteredHistory.map((r, i) => {
                  const name = resolveHeadRatingPujariName(r.pujari_id, people, r.pujari_name);
                  const starCount = Number(r.stars || 0);
                  const created = r.created_at
                    ? new Date(String(r.created_at)).toLocaleString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "";
                  return (
                    <View
                      key={String(r.id || i)}
                      style={{
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.border,
                        borderRadius: 12,
                        padding: 12,
                        backgroundColor: colors.card,
                        gap: 6,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                        <AppText style={{ fontWeight: "700", flex: 1 }} numberOfLines={2}>
                          {name}
                        </AppText>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <HistoryStars stars={starCount} color={colors.primary} />
                          <AppText variant="small" style={{ fontWeight: "700" }}>
                            {starCount.toFixed(1)}
                          </AppText>
                        </View>
                      </View>
                      <AppText variant="small" color={colors.mutedForeground}>
                        &ldquo;{String(r.comments || "")}&rdquo;
                      </AppText>
                      {created ? (
                        <AppText variant="small" color={colors.mutedForeground}>
                          {created}
                        </AppText>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.background }} />
    </Screen>
  );
}
