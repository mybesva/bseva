import { rupees } from "@bseva/config";
import type { Booking } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { PujariDashboardSection } from "@/components/PujariDashboardSection";
import { PujariHomeHeader } from "@/components/PujariHomeHeader";
import { PujariQuickActions } from "@/components/PujariQuickActions";
import { PujariStatGrid } from "@/components/PujariStatGrid";
import { PujariTodaySchedule } from "@/components/PujariTodaySchedule";
import { PujariVerificationAlert } from "@/components/PujariVerificationAlert";
import { PujariWelcomeHero, pujariGreetingName } from "@/components/PujariWelcomeHero";
import { LoadingBlock, Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { pujariTodayScheduleBookings } from "@/utils/pujariTodaySchedule";
import {
  filterAndSortBookings,
  isOngoingBooking,
  isPendingAcceptanceBooking,
  isReadyToStartBooking,
  PUJARI_DASHBOARD_FEATURED_LIMIT,
  pujariBookingsHref,
  pujariDashboardStats,
} from "@/utils/pujariBookings";
import { shouldShowPujariVerificationAlert } from "@/utils/pujariVerification";

type FeaturedSection = {
  title: string;
  bookings: Booking[];
  viewAllHref: ReturnType<typeof pujariBookingsHref>;
  emptyText?: string;
};

function buildFeaturedSection(
  ongoing: Booking[],
  readyToStart: Booking[],
  t: (key: string) => string,
): FeaturedSection | null {
  if (ongoing.length > 0) {
    return {
      title: t("priest.ongoingPuja"),
      bookings: ongoing.slice(0, PUJARI_DASHBOARD_FEATURED_LIMIT),
      viewAllHref: pujariBookingsHref("upcoming", "in_progress"),
      emptyText: t("mobile.noOngoingPuja"),
    };
  }
  if (readyToStart.length > 0) {
    return {
      title: t("pujari.dashboard.upcomingPuja"),
      bookings: readyToStart.slice(0, PUJARI_DASHBOARD_FEATURED_LIMIT),
      viewAllHref: pujariBookingsHref("upcoming", "confirmed"),
    };
  }
  return null;
}

export default function PujariHome() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const router = useRouter();
  const profile = useQuery({ queryKey: ["pujari-profile"], queryFn: () => apiClient.getPujariProfile() });
  const bookings = useQuery({ queryKey: ["bookings"], queryFn: () => apiClient.listBookings() });

  useFocusEffect(
    useCallback(() => {
      void bookings.refetch();
    }, [bookings.refetch]),
  );

  const now = useMemo(() => new Date(), [bookings.dataUpdatedAt]);
  const allBookings = bookings.data || [];
  const p = profile.data || {};
  const showVerificationAlert = shouldShowPujariVerificationAlert(p);

  const stats = useMemo(() => pujariDashboardStats(allBookings, now), [allBookings, now]);

  const monthLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(lang === "en" ? "en-IN" : lang, { month: "long", year: "numeric" }).format(now);
    } catch {
      return now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
  }, [lang, now]);

  const ongoing = useMemo(
    () => filterAndSortBookings(allBookings, (b) => isOngoingBooking(b, now), now),
    [allBookings, now],
  );

  const ongoingIds = useMemo(() => new Set(ongoing.map((b) => b.id)), [ongoing]);

  const readyToStart = useMemo(
    () =>
      filterAndSortBookings(
        allBookings,
        (b) => isReadyToStartBooking(b, now) && !ongoingIds.has(b.id),
        now,
      ),
    [allBookings, now, ongoingIds],
  );

  const pendingAcceptance = useMemo(
    () => filterAndSortBookings(allBookings, (b) => isPendingAcceptanceBooking(b, now), now),
    [allBookings, now],
  );

  const pendingPreview = useMemo(
    () => pendingAcceptance.slice(0, PUJARI_DASHBOARD_FEATURED_LIMIT),
    [pendingAcceptance],
  );

  const featuredSection = useMemo(
    () => buildFeaturedSection(ongoing, readyToStart, t),
    [ongoing, readyToStart, t],
  );

  const todaySchedule = useMemo(
    () => pujariTodayScheduleBookings(allBookings, now, 3),
    [allBookings, now],
  );

  const pujariName = pujariGreetingName(
    String(p.full_name || user?.name || ""),
    t("auth.pujari"),
  );

  return (
    <Screen>
      <PujariHomeHeader notificationsHref="/pujari/notifications" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={bookings.isRefetching || profile.isRefetching}
            onRefresh={() => {
              void bookings.refetch();
              void profile.refetch();
            }}
          />
        }
      >
        {profile.isLoading ? <LoadingBlock /> : null}

        <PujariWelcomeHero pujariName={pujariName} />

        {showVerificationAlert ? <PujariVerificationAlert profile={p} /> : null}

        <PujariStatGrid
          totalDakshina={rupees(stats.totalEarnings)}
          monthDakshina={rupees(stats.monthEarnings)}
          monthLabel={monthLabel}
          upcomingCount={stats.upcomingCount}
          pendingCount={stats.pendingCount}
          completedCount={stats.completedCount}
          completedEarnings={rupees(stats.completedEarnings)}
        />

        {featuredSection ? (
          <PujariDashboardSection
            title={featuredSection.title}
            bookings={featuredSection.bookings}
            viewAllHref={featuredSection.viewAllHref}
            emptyText={featuredSection.emptyText}
            featured
          />
        ) : (
          <PujariDashboardSection
            title={t("pujari.dashboard.upcomingPuja")}
            bookings={[]}
            viewAllHref={pujariBookingsHref("upcoming", "all")}
            emptyText={t("mobile.noBookingsList")}
            featured
          />
        )}

        {pendingPreview.length > 0 ? (
          <PujariDashboardSection
            title={t("pujari.dashboard.newPujaRequests")}
            bookings={pendingPreview}
            viewAllHref={pujariBookingsHref("upcoming", "pending")}
            cardVariant="request"
          />
        ) : null}

        <PujariQuickActions />

        <PujariTodaySchedule bookings={todaySchedule} onViewCalendar={() => router.push("/pujari/schedule")} />
      </ScrollView>
    </Screen>
  );
}
