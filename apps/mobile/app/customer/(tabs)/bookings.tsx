import { BOOKING_TYPE_FILTERS, DONE_BOOKING_STATUSES, rupees, sevaTypeFilter } from "@bseva/config";
import type { Booking, SevaRegistration } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, ChoiceChips, EmptyState, LoadingBlock, Screen, StatusBadge } from "@/components/ui";
import { SevaRegistrationCard } from "@/components/customer/SevaRegistrationCard";
import { PujaTitle } from "@/components/PujaTitle";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { formatDisplayDate, formatDisplaySlot } from "@/utils/formatDate";
import { useI18n } from "@/providers/I18nProvider";

type TypeFilter = (typeof BOOKING_TYPE_FILTERS)[number]["id"] | "live";

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [...BOOKING_TYPE_FILTERS, { id: "live", label: "Live" }];

function isLive(reg: SevaRegistration, now: number): boolean {
  const start = Date.parse(String(reg.event_start_at || ""));
  const end = Date.parse(String(reg.event_end_at || reg.event_start_at || ""));
  return start <= now && now <= end;
}

function sevaMatches(reg: SevaRegistration, type: TypeFilter): boolean {
  if (type === "all") return true;
  if (type === "live") return isLive(reg, Date.now());
  return sevaTypeFilter(reg.service_type) === type;
}

export default function CustomerBookings() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { from, type: typeParam } = useLocalSearchParams<{ from?: string; type?: string }>();
  const [type, setType] = useState<TypeFilter>("all");
  const { t } = useI18n();
  const listReturnTo = from === "more" ? "/customer/(tabs)/more" : "/customer/(tabs)/bookings";
  const q = useQuery({ queryKey: ["bookings"], queryFn: () => apiClient.listBookings() });
  const seva = useQuery({
    queryKey: ["my-seva-registrations", {}],
    queryFn: () => apiClient.listMySevaRegistrations({}),
  });
  useEffect(() => {
    if (TYPE_FILTERS.some((f) => f.id === typeParam)) setType(typeParam as TypeFilter);
  }, [typeParam]);
  const rows = type === "all" || type === "bookings" ? q.data || [] : [];
  const registrations = type === "bookings" ? [] : ((seva.data || []) as SevaRegistration[]).filter((r) => sevaMatches(r, type));
  const sevaDone = (r: SevaRegistration) => ["completed", "cancelled", "refunded"].includes(String(r.status));
  const upcoming = rows.filter((b) => !DONE_BOOKING_STATUSES.includes(b.status as never));
  const past = rows.filter((b) => DONE_BOOKING_STATUSES.includes(b.status as never));
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">{t("mobile.myBookings")}</AppText>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching || seva.isRefetching}
            onRefresh={() => {
              void q.refetch();
              void seva.refetch();
            }}
          />
        }
      >
        <ChoiceChips options={TYPE_FILTERS} value={type} onChange={(next) => setType(next as TypeFilter)} />
        {q.isLoading || seva.isLoading ? <LoadingBlock /> : null}
        {!q.isLoading && !seva.isLoading && rows.length === 0 && registrations.length === 0 ? <EmptyState title={t("mobile.noBookings")} subtitle={t("mobile.bookFromServices")} /> : null}
        {upcoming.map((b: Booking) => (
          <Pressable
            key={b.id}
            onPress={() =>
              router.push({
                pathname: `/customer/booking/${b.id}`,
                params: { returnTo: listReturnTo },
              } as never)
            }
          >
            <Card>
              <AppText variant="small" color={colors.primary} style={{ fontWeight: "700" }}>
                Puja Booking
              </AppText>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <PujaTitle name={b.service_name} variant="h3" style={{ flex: 1 }} />
                <StatusBadge status={b.customer_display_status || b.status} />
              </View>
              <AppText variant="small" color={colors.mutedForeground}>
                #{b.booking_number} · {formatDisplaySlot(b.booking_date, b.start_time)}
              </AppText>
              {!b.pujari_details_visible && !["cancelled", "refunded", "completed"].includes(String(b.status)) ? (
                <AppText variant="small" color={colors.mutedForeground}>{t("booking.pujariSharedLater")}</AppText>
              ) : null}
              <AppText style={{ marginTop: 6 }}>{rupees(b.total_paise)}</AppText>
            </Card>
          </Pressable>
        ))}
        {registrations.filter((r) => !sevaDone(r)).map((reg) => (
          <SevaRegistrationCard key={reg.id} reg={reg} />
        ))}
        {past.length > 0 || registrations.some(sevaDone) ? <AppText variant="h3">{t("mobile.history")}</AppText> : null}
        {past.map((b: Booking) => (
          <Pressable
            key={b.id}
            onPress={() =>
              router.push({
                pathname: `/customer/booking/${b.id}`,
                params: { returnTo: listReturnTo },
              } as never)
            }
          >
            <Card>
              <AppText variant="small" color={colors.primary} style={{ fontWeight: "700" }}>
                Puja Booking
              </AppText>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <PujaTitle name={b.service_name} variant="h3" style={{ flex: 1 }} />
                <StatusBadge status={b.customer_display_status || b.status} />
              </View>
              <AppText variant="small">{formatDisplayDate(b.booking_date)}</AppText>
            </Card>
          </Pressable>
        ))}
        {registrations.filter(sevaDone).map((reg) => (
          <SevaRegistrationCard key={reg.id} reg={reg} />
        ))}
        <Pressable
          onPress={() => router.push("/customer/family-sankalp")}
          style={{ paddingVertical: 12, alignItems: "center" }}
          accessibilityRole="button"
        >
          <AppText color={colors.primary} style={{ fontWeight: "700" }}>
            {t("seva.familySankalp")}
          </AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
