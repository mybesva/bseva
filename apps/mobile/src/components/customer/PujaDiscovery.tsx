import {
  buildServicesApiQuery,
  pujaServicesOnly,
  splitAvailableUpcoming,
} from "@bseva/config";
import type { CatalogService } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { PujaServiceCard } from "@/components/PujaImage";
import { AppText, EmptyState, ErrorBanner, LoadingBlock } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

const SEARCH_DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Puja Seva on mobile: search, All / Popular / category chips, Available and Upcoming Pujas.
 *
 * Uses `GET /services?q=&category=` (same server-side search, Popular and category-map filtering
 * as web), so translated names, aliases and descriptions behave the same. That endpoint can also
 * return Chadhava and Pravachan rows, so results are restricted to Puja here.
 */
export function PujaDiscovery({
  initialQuery = "",
  slug,
}: {
  initialQuery?: string;
  /** Optional exact-slug filter (used by deep links into browse-services). */
  slug?: string;
}) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { t, lang } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("all");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  const categoriesQ = useQuery({
    queryKey: ["service-categories", lang],
    queryFn: () => apiClient.serviceCategories(),
  });

  const servicesQ = useQuery({
    queryKey: ["services", "discovery", lang, category, debouncedQuery.trim()],
    queryFn: () => apiClient.listServices(buildServicesApiQuery({ q: debouncedQuery, category })),
    placeholderData: (previous) => previous,
  });

  const chips = useMemo(
    () => [
      { slug: "all", name: t("common.all") },
      { slug: "popular", name: t("services.popular") },
      ...(categoriesQ.data || []).map((c) => ({ slug: c.slug, name: c.name })),
    ],
    [categoriesQ.data, t]
  );

  const rows = useMemo(() => {
    const pujas = pujaServicesOnly(servicesQ.data);
    return slug ? pujas.filter((s) => s.slug === slug) : pujas;
  }, [servicesQ.data, slug]);
  const { available, upcoming } = useMemo(() => splitAvailableUpcoming(rows), [rows]);

  const openService = (s: CatalogService) => router.push(`/service/${s.slug}`);
  const loading = servicesQ.isLoading;
  const errorMessage = servicesQ.isError
    ? servicesQ.error instanceof Error && servicesQ.error.message
      ? servicesQ.error.message
      : t("errors.generic")
    : null;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("services.searchPujas")}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={t("services.searchPujas")}
          returnKeyType="search"
          autoCorrect={false}
          style={{
            backgroundColor: colors.input,
            borderRadius: 8,
            padding: 12,
            color: colors.foreground,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 8, paddingRight: 16 }}
        >
          {chips.map((c) => {
            const selected = category === c.slug;
            return (
              <Pressable
                key={c.slug}
                onPress={() => setCategory(c.slug)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: selected ? colors.primary : colors.secondary,
                }}
              >
                <AppText
                  variant="small"
                  color={selected ? colors.primaryForeground : colors.foreground}
                  style={{ fontWeight: "600" }}
                >
                  {c.name}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={servicesQ.isRefetching && !servicesQ.isLoading}
            onRefresh={() => {
              void servicesQ.refetch();
              void categoriesQ.refetch();
            }}
          />
        }
      >
        <ErrorBanner message={errorMessage} />
        {loading ? <LoadingBlock /> : null}
        {!loading && !errorMessage && rows.length === 0 ? <EmptyState title={t("services.noPujas")} /> : null}
        {available.length > 0 ? (
          <>
            <AppText variant="h3">{t("services.availablePujas")}</AppText>
            {available.map((s) => (
              <PujaServiceCard key={s.id} service={s} onPress={() => openService(s)} />
            ))}
          </>
        ) : null}
        {upcoming.length > 0 ? (
          <>
            <AppText variant="h3" style={{ marginTop: available.length > 0 ? 8 : 0 }}>
              {t("services.upcomingServices")}
            </AppText>
            {upcoming.map((s) => (
              <PujaServiceCard key={s.id} service={s} onPress={() => openService(s)} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
