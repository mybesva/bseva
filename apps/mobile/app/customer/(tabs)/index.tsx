import { pujaServicesOnly } from "@bseva/config";
import type { Booking, CatalogService } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Image, Linking, Pressable, RefreshControl, ScrollView } from "react-native";
import { CustomerWelcomeHero, customerGreetingName } from "@/components/CustomerWelcomeHero";
import { PanchangCard } from "@/components/PanchangCard";
import { HomeBrandBar } from "@/components/ScreenHeader";
import { SeasonalPopup } from "@/components/SeasonalPopup";
import { AppText, Card, EmptyState, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import {
  CustomerQuickActions,
  OngoingPujaCard,
  RecommendedRail,
  SectionHeader,
  UpcomingList,
} from "@/components/customer/CustomerHomeSections";
import { PujaServiceCard } from "@/components/PujaImage";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function CustomerHome() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const bookings = useQuery({ queryKey: ["bookings"], queryFn: () => apiClient.listBookings() });
  const services = useQuery({ queryKey: ["services", lang], queryFn: () => apiClient.listServices() });
  const recs = useQuery({ queryKey: ["recommendations"], queryFn: () => apiClient.recommendations() });
  const banners = useQuery({
    queryKey: ["promos", "post_login"],
    queryFn: () => apiClient.promoBanners("post_login"),
  });
  const profile = useQuery({
    queryKey: ["customer-profile"],
    queryFn: () => apiClient.getCustomerProfile() as Promise<Record<string, string | number | null>>,
    staleTime: 0,
  });
  const config = useQuery({ queryKey: ["public-config"], queryFn: () => apiClient.publicConfig() });
  const rawLat = profile.data?.latitude;
  const rawLng = profile.data?.longitude;
  const profileLat = rawLat == null || rawLat === "" ? NaN : Number(rawLat);
  const profileLng = rawLng == null || rawLng === "" ? NaN : Number(rawLng);
  const hasCoords =
    Number.isFinite(profileLat) &&
    Number.isFinite(profileLng) &&
    !(profileLat === 0 && profileLng === 0);
  const availability = useQuery({
    queryKey: ["service-availability", profileLat, profileLng],
    queryFn: () => apiClient.serviceAvailability(profileLat, profileLng),
    enabled: hasCoords,
    staleTime: 0,
  });
  useFocusEffect(
    useCallback(() => {
      void profile.refetch();
      void availability.refetch();
    }, [profile.refetch, availability.refetch])
  );
  // Same window as web: in progress, or confirmed and starting within the next 24h (until 2h after start).
  const ongoing = (bookings.data || []).filter((b) => {
    if (b.status === "in_progress") return true;
    if (b.status !== "confirmed" || !b.booking_date) return false;
    const start = new Date(`${String(b.booking_date).slice(0, 10)}T${String(b.start_time || "00:00").slice(0, 5)}:00`);
    const ms = start.getTime() - Date.now();
    return ms <= 24 * 60 * 60 * 1000 && ms >= -2 * 60 * 60 * 1000;
  });
  const ongoingIds = new Set(ongoing.map((b) => String(b.id)));
  const upcoming = (bookings.data || [])
    .filter((b) => !ongoingIds.has(String(b.id)))
    .filter((b) => ["pending", "pending_acceptance", "confirmed"].includes(String(b.customer_display_status || b.status)))
    .slice(0, 3);
  const recItems = recs.data?.items || (Array.isArray(recs.data) ? recs.data : []);

  return (
    <Screen>
      {/* Fixed header: stays put while the home content scrolls underneath. */}
      <HomeBrandBar notificationsHref="/customer/notifications" />
      <SeasonalPopup />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={bookings.isRefetching || profile.isRefetching || availability.isRefetching}
            onRefresh={() => {
              void bookings.refetch();
              void services.refetch();
              void profile.refetch();
              void availability.refetch();
              void config.refetch();
            }}
          />
        }
      >
        <CustomerWelcomeHero
          customerName={customerGreetingName(user?.name, t("auth.customer"))}
          publicId={(user as { public_id?: string } | null)?.public_id}
        />
        <CustomerQuickActions />
        {hasCoords && availability.data && availability.data.service_available === false ? (
          <Card style={{ gap: 8, borderColor: colors.warning }}>
            <AppText variant="h3">
              {String(config.data?.service_area_unavailable_heading || t("web.availability.comingSoonTitle"))}
            </AppText>
            <AppText color={colors.mutedForeground}>
              {String(config.data?.service_area_unavailable_description || t("web.availability.comingSoonBody"))}
            </AppText>
            {String(profile.data?.location_label || profile.data?.city || "").trim() ? (
              <AppText variant="small" color={colors.mutedForeground}>
                {String(profile.data?.location_label || profile.data?.city)}
              </AppText>
            ) : null}
            <PrimaryButton title={t("web.availability.myAddress")} variant="outline" onPress={() => router.push("/customer/address")} />
            <PrimaryButton
              title={t("web.availability.checkLocation")}
              variant="ghost"
              onPress={() => {
                void profile.refetch();
                void availability.refetch();
              }}
            />
            {config.data?.virtual_puja_enabled ? (
              <PrimaryButton title={t("web.availability.bookVirtual")} onPress={() => router.push("/customer/services")} />
            ) : null}
          </Card>
        ) : null}
        {(banners.data || []).slice(0, 5).map((banner) => (
          <Pressable
            key={banner.id}
            disabled={!banner.target_url}
            onPress={() => banner.target_url ? void Linking.openURL(banner.target_url) : undefined}
          >
            <Card style={{ overflow: "hidden", gap: 8 }}>
              {banner.image_url ? (
                <Image
                  source={{ uri: apiClient.mediaUrl(banner.image_url) }}
                  resizeMode="contain"
                  style={{ width: "100%", aspectRatio: 16 / 7, backgroundColor: colors.secondary, borderRadius: 10 }}
                />
              ) : null}
              <AppText variant="h3">{banner.title || t("web.promo.untitled")}</AppText>
              {banner.subtitle ? <AppText variant="small">{banner.subtitle}</AppText> : null}
            </Card>
          </Pressable>
        ))}
        {bookings.isLoading ? <LoadingBlock /> : null}
        {ongoing.length > 0 ? (
          <>
            <SectionHeader
              title={t("customer.ongoingPuja")}
              actionLabel={t("common.viewAll")}
              onAction={() => router.push("/customer/bookings")}
            />
            {ongoing.map((b: Booking) => (
              <OngoingPujaCard key={b.id} booking={b} />
            ))}
          </>
        ) : null}
        <PanchangCard />
        {upcoming.length > 0 ? (
          <>
            <SectionHeader
              title={t("mobile.upcoming")}
              actionLabel={t("common.viewAll")}
              onAction={() => router.push("/customer/bookings")}
            />
            <UpcomingList bookings={upcoming} />
          </>
        ) : null}
        {recItems.length > 0 ? (
          <>
            <SectionHeader title={t("mobile.recommended")} />
            <RecommendedRail items={recItems} />
          </>
        ) : null}
        <SectionHeader
          title={t("customer.bookServices")}
          actionLabel={t("common.viewAll")}
          onAction={() => router.push("/customer/services")}
        />
        {pujaServicesOnly(services.data).slice(0, 6).map((s: CatalogService) => (
          <PujaServiceCard key={s.id} service={s} onPress={() => router.push(`/service/${s.slug}`)} />
        ))}
        {(services.data || []).length === 0 && !services.isLoading ? (
          <EmptyState title={t("mobile.noServices")} subtitle={t("mobile.bookFromServices")} />
        ) : null}
        <PrimaryButton title={t("home.viewAllServices")} variant="outline" onPress={() => router.push("/customer/services")} />
      </ScrollView>
    </Screen>
  );
}
