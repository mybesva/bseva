import {
  ADMIN_ASSIGNMENT_FILTERS,
  ADMIN_BOOKING_STATUS_FILTERS,
  ADMIN_DATE_RANGE_FILTERS,
  adminBookingLast30Range,
  displayTokenLabel,
  rupees,
} from "@bseva/config";
import type { Booking } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PujaTitle } from "@/components/PujaTitle";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SupportSelect } from "@/components/support/SupportSelect";
import { AppText, Card, EmptyState, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type BookingRow = Booking & {
  customer_country?: string;
  customer_timezone?: string;
  schedule_display?: { customer_local?: string; india_local?: string };
  needs_reassignment?: boolean;
  payment_status?: string;
};

export default function AdminBookings({ mode = "physical" }: { mode?: string }) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const isVirtual = mode === "virtual";
  const params = useLocalSearchParams<{ status?: string; assignment?: string; range?: string; from?: string; to?: string }>();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [assignment, setAssignment] = useState("");
  const [range, setRange] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (typeof params.status === "string") setStatus(params.status);
    if (typeof params.assignment === "string") setAssignment(params.assignment);
    if (typeof params.range === "string") setRange(params.range);
    if (typeof params.from === "string") setDateFrom(params.from);
    if (typeof params.to === "string") setDateTo(params.to);
  }, [params.status, params.assignment, params.range, params.from, params.to]);

  const queryParams = useMemo(() => {
    const extra: Record<string, string | number> = { page, limit: 20, mode };
    if (q.trim()) extra.q = q.trim();
    if (status) extra.status = status;
    if (assignment) extra.assignment = assignment;
    if (range === "last_30") {
      const { from, to } = adminBookingLast30Range();
      extra.date_from = from;
      extra.date_to = to;
    } else if (range === "custom") {
      if (dateFrom) extra.date_from = dateFrom;
      if (dateTo) extra.date_to = dateTo;
    }
    return extra;
  }, [assignment, dateFrom, dateTo, mode, page, q, range, status]);

  const list = useQuery({
    queryKey: ["admin-bookings", queryParams],
    queryFn: () => apiClient.listBookingsPage(queryParams),
  });

  const items = (list.data?.items || []) as BookingRow[];

  function resetFilters() {
    setQ("");
    setStatus("");
    setAssignment("");
    setRange("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  const hasActiveFilters = Boolean(q.trim() || status || assignment || range || dateFrom || dateTo);

  return (
    <Screen>
      {isVirtual ? (
        <ScreenHeader title={t("admin.virtualPuja")} back />
      ) : (
        <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <AppText variant="h2">{t("admin.bookings")}</AppText>
        </SafeAreaView>
      )}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
        keyboardShouldPersistTaps="handled"
      >
        {isVirtual ? (
          <AppText variant="small" color={colors.mutedForeground}>
            Virtual & Online Puja bookings with customer local time and India (IST) assignment time.
          </AppText>
        ) : null}

        <Field
          label={t("admin.search")}
          value={q}
          onChangeText={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder="Search number, customer, pujari, service"
        />

        <SupportSelect
          label="Status"
          value={status}
          options={ADMIN_BOOKING_STATUS_FILTERS.map((o) => ({ id: o.id, label: o.label }))}
          placeholder="All statuses"
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
        <SupportSelect
          label="Pujari"
          value={assignment}
          options={ADMIN_ASSIGNMENT_FILTERS.map((o) => ({ id: o.id, label: o.label }))}
          placeholder="All assignments"
          onChange={(v) => {
            setAssignment(v);
            setPage(1);
          }}
        />
        <SupportSelect
          label="Customer date"
          value={range}
          options={ADMIN_DATE_RANGE_FILTERS.map((o) => ({ id: o.id, label: o.label }))}
          placeholder="All dates"
          onChange={(v) => {
            setRange(v);
            if (v !== "custom") {
              setDateFrom("");
              setDateTo("");
            }
            setPage(1);
          }}
        />
        {range === "custom" ? (
          <>
            <Field label="From (YYYY-MM-DD)" value={dateFrom} onChangeText={setDateFrom} />
            <Field label="To (YYYY-MM-DD)" value={dateTo} onChangeText={setDateTo} />
          </>
        ) : null}
        {hasActiveFilters ? (
          <PrimaryButton title="Clear filters" variant="outline" onPress={resetFilters} />
        ) : null}

        {list.isLoading ? <LoadingBlock /> : null}
        {list.error ? <ErrorBanner message={list.error instanceof Error ? list.error.message : "Failed"} /> : null}
        {items.length === 0 && !list.isLoading ? (
          <EmptyState title="No bookings match these filters." />
        ) : null}

        {items.map((b) => {
          const needsAttention = Boolean(b.needs_reassignment) || b.status === "rejected" || !b.pujari_id;
          return (
            <Pressable key={b.id} onPress={() => router.push(`/booking/${b.id}`)}>
              <Card style={{ gap: 6, borderColor: needsAttention ? colors.destructive : undefined }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  {b.service_name ? (
                    <PujaTitle name={b.service_name} variant="h3" style={{ flex: 1 }} />
                  ) : (
                    <AppText variant="h3">{b.booking_number}</AppText>
                  )}
                  <StatusBadge status={b.status} />
                </View>
                <AppText variant="small">{b.customer_name} · {b.pujari_name || "Needs assignment"}</AppText>
                {isVirtual ? (
                  <>
                    <AppText variant="small" color={colors.mutedForeground}>
                      {(b.customer_country || "—") + " · " + (b.customer_timezone || "—")}
                    </AppText>
                    <AppText variant="small">
                      Customer: {b.schedule_display?.customer_local || `${b.booking_date} ${b.start_time}`}
                    </AppText>
                    <AppText variant="small">
                      India: {b.schedule_display?.india_local || `${b.booking_date} ${b.start_time} IST`}
                    </AppText>
                  </>
                ) : (
                  <AppText variant="small" color={colors.mutedForeground}>
                    {b.booking_date} {b.start_time}
                  </AppText>
                )}
                <AppText variant="small">
                  {rupees(b.total_paise)}
                  {b.payment_status ? ` · ${displayTokenLabel(b.payment_status)}` : ""}
                </AppText>
                {!b.pujari_id ? (
                  <AppText variant="small" color={colors.destructive}>Assign pujari</AppText>
                ) : null}
                {b.pujari_id && b.needs_reassignment ? (
                  <AppText variant="small" color={colors.destructive}>Needs reassignment</AppText>
                ) : null}
              </Card>
            </Pressable>
          );
        })}

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8 }}>
          <Pressable onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <AppText color={page <= 1 ? colors.mutedForeground : colors.primary}>Prev</AppText>
          </Pressable>
          <AppText variant="small">
            Page {page} / {list.data?.pages || 1}
            {list.data?.total != null ? ` · ${list.data.total} total` : ""}
          </AppText>
          <Pressable onPress={() => setPage((p) => p + 1)} disabled={page >= (list.data?.pages || 1)}>
            <AppText color={page >= (list.data?.pages || 1) ? colors.mutedForeground : colors.primary}>Next</AppText>
          </Pressable>
        </View>
      </ScrollView>
      {isVirtual ? <SafeAreaView edges={["bottom"]} /> : null}
    </Screen>
  );
}
