import { servicesOfType } from "@bseva/config";
import type { CatalogService, SevaEvent, ServiceType } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { PujaServiceCard } from "@/components/PujaImage";
import { SevaEventCard } from "@/components/customer/SevaEventCard";
import { AppText, EmptyState, ErrorBanner, LoadingBlock } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

/**
 * Chadhava Seva / Pravachan Seva on mobile. Uses the existing Seva service and event APIs.
 * Services open the service detail; events open `/customer/seva/event/:id` (Seva registration).
 */
export function SevaTypePane({ type }: { type: Exclude<ServiceType, "puja"> }) {
  const router = useRouter();
  const { t } = useI18n();

  const servicesQ = useQuery({
    queryKey: ["seva-services", type],
    queryFn: () => apiClient.listSevaServices(type),
  });
  const eventsQ = useQuery({
    queryKey: ["seva-events", type],
    queryFn: () => apiClient.listSevaEvents({ service_type: type }),
  });

  const services = useMemo(() => servicesOfType((servicesQ.data || []) as CatalogService[], type), [servicesQ.data, type]);
  const events = useMemo(
    () => ((eventsQ.data || []) as SevaEvent[]).filter((e) => !e.service_type || e.service_type === type),
    [eventsQ.data, type]
  );

  const loading = servicesQ.isLoading || eventsQ.isLoading;
  const failure = servicesQ.error || eventsQ.error;
  const errorMessage = failure ? (failure instanceof Error && failure.message ? failure.message : t("errors.generic")) : null;
  const refreshing = (servicesQ.isRefetching || eventsQ.isRefetching) && !loading;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void servicesQ.refetch();
            void eventsQ.refetch();
          }}
        />
      }
    >
      <ErrorBanner message={errorMessage} />
      {loading ? <LoadingBlock /> : null}
      {!loading ? (
        <>
          {services.length > 0 ? (
            <>
              <AppText variant="h3">{t(`seva.${type}` as "seva.chadhava")}</AppText>
              {services.map((service) => (
                <PujaServiceCard key={service.id} service={service} onPress={() => router.push(`/service/${service.slug}`)} />
              ))}
            </>
          ) : null}
          <AppText variant="h3" style={{ marginTop: services.length > 0 ? 8 : 0 }}>
            {t("seva.events")}
          </AppText>
          {events.length === 0 && !errorMessage ? (
            <EmptyState title={t("seva.noEvents")} />
          ) : (
            events.map((event) => (
              <SevaEventCard key={event.id} event={event} onPress={() => router.push(`/customer/seva/event/${event.id}`)} />
            ))
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
