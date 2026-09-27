import { isExpiredBooking, matchesPujariJobSegment, type PujariJobSegment } from "@bseva/config";
import type { Booking } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PujariBookingsFilter, type PujariStatusFilter } from "@/components/PujariBookingsFilter";
import { PujariDashboardBookingCard } from "@/components/PujariDashboardBookingCard";
import { AppText, EmptyState, LoadingBlock, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { compareBookingsBySchedule } from "@/utils/pujariBookings";
import { useI18n } from "@/providers/I18nProvider";

const STATUS_FILTERS: PujariStatusFilter[] = [
  "all",
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "expired",
];

function paramOne(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function parseSegment(value: string): PujariJobSegment {
  const segments: PujariJobSegment[] = ["all", "upcoming", "completed", "cancelled", "expired"];
  return segments.includes(value as PujariJobSegment) ? (value as PujariJobSegment) : "all";
}

function parseStatus(value: string): PujariStatusFilter {
  return STATUS_FILTERS.includes(value as PujariStatusFilter) ? (value as PujariStatusFilter) : "all";
}

export default function PujariJobs() {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const params = useLocalSearchParams<{
    tab?: string | string[];
    segment?: string | string[];
    status?: string | string[];
    q?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>();

  const [segment, setSegment] = useState<PujariJobSegment>(() =>
    parseSegment(paramOne(params.tab) || paramOne(params.segment) || "all"),
  );
  const [status, setStatus] = useState<PujariStatusFilter>(() => parseStatus(paramOne(params.status) || "all"));
  const [from, setFrom] = useState(() => paramOne(params.from));
  const [to, setTo] = useState(() => paramOne(params.to));
  const [qtext, setQtext] = useState(() => paramOne(params.q));

  const syncFromParams = useCallback(() => {
    setSegment(parseSegment(paramOne(params.tab) || paramOne(params.segment) || "all"));
    setStatus(parseStatus(paramOne(params.status) || "all"));
    setFrom(paramOne(params.from));
    setTo(paramOne(params.to));
    setQtext(paramOne(params.q));
  }, [params.tab, params.segment, params.status, params.from, params.to, params.q]);

  useEffect(() => {
    syncFromParams();
  }, [syncFromParams]);

  const q = useQuery({ queryKey: ["bookings"], queryFn: () => apiClient.listBookings() });

  useFocusEffect(
    useCallback(() => {
      syncFromParams();
      void q.refetch();
    }, [syncFromParams, q.refetch]),
  );

  const now = useMemo(() => new Date(), [q.dataUpdatedAt]);

  const rows = useMemo(() => {
    const needle = qtext.trim().toLowerCase();
    return [...(q.data || [])]
      .filter((b) => matchesPujariJobSegment(segment, b.status, b.booking_date, b.start_time, now))
      .filter((b) => {
        if (status === "all") return true;
        if (status === "expired") return isExpiredBooking(b.status, b.booking_date, b.start_time, now);
        if (status === "pending") {
          return (
            ["pending", "pending_acceptance"].includes(String(b.status || "")) &&
            !isExpiredBooking(b.status, b.booking_date, b.start_time, now)
          );
        }
        return String(b.status || "") === status;
      })
      .filter((b) => {
        if (!from && !to) return true;
        const d = String(b.booking_date || "").slice(0, 10);
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      })
      .filter((b) => {
        if (!needle) return true;
        return [b.service_name, b.booking_number, b.customer_name, b.location_label]
          .map((x) => String(x || "").toLowerCase())
          .some((x) => x.includes(needle));
      })
      .sort((a, b) => {
        if (segment === "upcoming" || status === "pending" || status === "confirmed" || status === "in_progress") {
          return compareBookingsBySchedule(a, b, "asc");
        }
        return compareBookingsBySchedule(a, b, "desc");
      });
  }, [q.data, segment, status, from, to, qtext, now]);

  const hasActiveFilters =
    segment !== "all" || status !== "all" || !!from || !!to || !!qtext.trim();

  function clearFilters() {
    setSegment("all");
    setStatus("all");
    setFrom("");
    setTo("");
    setQtext("");
  }

  function handleFromChange(iso: string) {
    setFrom(iso);
    if (to && iso && iso > to) setTo("");
  }

  function handleToChange(iso: string) {
    if (from && iso && iso < from) return;
    setTo(iso);
  }

  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">{t("mobile.bookings")}</AppText>
        <AppText variant="small" color={colors.mutedForeground}>
          {t("mobile.bookingsHelp")}
        </AppText>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 12, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
      >
        <PujariBookingsFilter
          segment={segment}
          status={status}
          from={from}
          to={to}
          qtext={qtext}
          count={rows.length}
          loading={q.isLoading}
          hasActiveFilters={hasActiveFilters}
          onSegmentChange={setSegment}
          onStatusChange={setStatus}
          onFromChange={handleFromChange}
          onToChange={handleToChange}
          onQtextChange={setQtext}
          onClear={clearFilters}
        />
        {q.isLoading ? <LoadingBlock /> : null}
        {!q.isLoading && rows.length === 0 ? <EmptyState title={t("mobile.noBookingsList")} /> : null}
        {rows.map((b: Booking) => (
          <PujariDashboardBookingCard key={b.id} booking={b} />
        ))}
      </ScrollView>
    </Screen>
  );
}
