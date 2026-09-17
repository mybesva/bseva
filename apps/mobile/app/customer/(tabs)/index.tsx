import { CALENDARS, rupees } from "@bseva/config";
import type { Booking, CatalogService } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Image, Linking, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, ChoiceChips, EmptyState, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { formatDisplayDate, formatDisplaySlot } from "@/utils/formatDate";

export default function CustomerHome() {
  const { user, refresh } = useAuth();
  const { t, lang } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const calendar = String(user?.calendar_preference || "north");
  const bookings = useQuery({ queryKey: ["bookings"], queryFn: () => apiClient.listBookings() });
  const services = useQuery({ queryKey: ["services", lang], queryFn: () => apiClient.listServices() });
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => apiClient.getWallet() as Promise<{ wallet?: { balance_paise?: number }; balance_paise?: number }> });
  const panchang = useQuery({ queryKey: ["panchang", today, calendar], queryFn: () => apiClient.panchang(today, calendar) as Promise<Record<string, unknown>> });
  const recs = useQuery({ queryKey: ["recommendations"], queryFn: () => apiClient.recommendations() });
  const banners = useQuery({
    queryKey: ["promos", "post_login"],
    queryFn: () => apiClient.promoBanners("post_login"),
  });
  const profile = useQuery({ queryKey: ["customer-profile"], queryFn: () => apiClient.getCustomerProfile() as Promise<Record<string, string | number | null>> });
  const config = useQuery({ queryKey: ["public-config"], queryFn: () => apiClient.publicConfig() });
  const profileLat = Number(profile.data?.latitude);
  const profileLng = Number(profile.data?.longitude);
  const hasCoords = Number.isFinite(profileLat) && Number.isFinite(profileLng);
  const availability = useQuery({
    queryKey: ["service-availability", profileLat, profileLng],
    queryFn: () => apiClient.serviceAvailability(profileLat, profileLng),
    enabled: hasCoords,
  });
  const ongoing = (bookings.data || []).filter((b) => b.status === "in_progress");
  const upcoming = (bookings.data || []).filter((b) => ["pending", "pending_acceptance", "confirmed"].includes(String(b.customer_display_status || b.status))).slice(0, 3);
  const balance = wallet.data?.wallet?.balance_paise ?? wallet.data?.balance_paise ?? 0;
  const recItems = recs.data?.items || (Array.isArray(recs.data) ? recs.data : []);

  return (
    <Screen>
      <View style={{ backgroundColor: colors.navy, paddingHorizontal: 20, paddingBottom: 24 }}>
        <SafeAreaView edges={["top"]}>
          <AppText variant="h1" color={colors.cream}>
            {t("customer.welcome")}, {user?.name}
          </AppText>
          <AppText color="rgba(255,248,231,0.8)">{t("customer.subtitle")}</AppText>
        </SafeAreaView>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={bookings.isRefetching}
            onRefresh={() => {
              void bookings.refetch();
              void wallet.refetch();
              void services.refetch();
              void panchang.refetch();
            }}
          />
        }
      >
        <Card>
          <AppText variant="small">{t("customer.wallet")}</AppText>
          <AppText variant="h1" color={colors.primary}>
            {rupees(Number(balance))}
          </AppText>
          <PrimaryButton title={t("customer.loadWallet")} onPress={() => router.push("/customer/wallet")} />
        </Card>
        {hasCoords && availability.data && availability.data.service_available === false ? (
          <Card style={{ gap: 8, borderColor: colors.warning }}>
            <AppText variant="h3">
              {String(config.data?.service_area_unavailable_heading || t("web.availability.comingSoonTitle"))}
            </AppText>
            <AppText color={colors.mutedForeground}>
              {String(config.data?.service_area_unavailable_description || t("web.availability.comingSoonBody"))}
            </AppText>
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
                  source={{ uri: banner.image_url }}
                  resizeMode="contain"
                  style={{ width: "100%", aspectRatio: 16 / 7, backgroundColor: colors.secondary, borderRadius: 10 }}
                />
              ) : null}
              <AppText variant="h3">{banner.title || t("web.promo.untitled")}</AppText>
              {banner.subtitle ? <AppText variant="small">{banner.subtitle}</AppText> : null}
            </Card>
          </Pressable>
        ))}
        <Card>
          <AppText variant="small">{t("mobile.calendar")} · {today}</AppText>
          <ChoiceChips
            options={CALENDARS.map((c) => ({ id: c, label: c }))}
            value={calendar}
            onChange={(v) => {
              void apiClient.patchMe({ calendar_preference: v }).then(() => refresh());
            }}
          />
          <AppText variant="small" color={colors.mutedForeground} style={{ marginTop: 8 }}>
            {String(panchang.data?.tithi || panchang.data?.summary || panchang.data?.nakshatra || t("mobile.panchangToday"))}
          </AppText>
        </Card>
        {bookings.isLoading ? <LoadingBlock /> : null}
        {ongoing.length > 0 ? (
          <>
            <AppText variant="h2">{t("customer.ongoingPuja")}</AppText>
            {ongoing.map((b: Booking) => (
              <Pressable key={b.id} onPress={() => router.push(`/customer/booking/${b.id}`)}>
                <Card>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <AppText variant="h3">{b.service_name}</AppText>
                    <StatusBadge status={b.customer_display_status || b.status} />
                  </View>
                  <AppText variant="small" color={colors.mutedForeground}>
                    #{b.booking_number} · {formatDisplayDate(b.booking_date)}
                  </AppText>
                </Card>
              </Pressable>
            ))}
          </>
        ) : null}
        {upcoming.length > 0 ? (
          <>
            <AppText variant="h2">{t("mobile.upcoming")}</AppText>
            {upcoming.map((b: Booking) => (
              <Pressable key={b.id} onPress={() => router.push(`/customer/booking/${b.id}`)}>
                <Card>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <AppText variant="h3">{b.service_name}</AppText>
                    <StatusBadge status={b.customer_display_status || b.status} />
                  </View>
                  <AppText variant="small">{formatDisplaySlot(b.booking_date, b.start_time)}</AppText>
                </Card>
              </Pressable>
            ))}
          </>
        ) : null}
        {recItems.length > 0 ? (
          <>
            <AppText variant="h2">{t("mobile.recommended")}</AppText>
            {recItems.slice(0, 5).map((item, i) => {
              const rec = item as { title?: string; name?: string; service_slug?: string; slug?: string };
              return (
                <Pressable key={i} onPress={() => rec.service_slug || rec.slug ? router.push(`/service/${rec.service_slug || rec.slug}`) : undefined}>
                  <Card>
                    <AppText>{rec.title || rec.name || t("mobile.recommendedPuja")}</AppText>
                  </Card>
                </Pressable>
              );
            })}
          </>
        ) : null}
        <AppText variant="h2">{t("customer.bookServices")}</AppText>
        {(services.data || []).slice(0, 6).map((s: CatalogService) => (
          <Pressable key={s.id} onPress={() => router.push(`/service/${s.slug}`)}>
            <Card>
              <AppText variant="h3">{s.name}</AppText>
              <AppText variant="small" color={colors.primary}>
                {s.standard_price_paise != null ? `${t("customer.from")} ${rupees(s.standard_price_paise)}` : t("services.comingSoonLabel")}
              </AppText>
            </Card>
          </Pressable>
        ))}
        {(services.data || []).length === 0 && !services.isLoading ? (
          <EmptyState title={t("mobile.noServices")} subtitle={t("mobile.bookFromServices")} />
        ) : null}
        <PrimaryButton title={t("home.viewAllServices")} variant="outline" onPress={() => router.push("/customer/services")} />
      </ScrollView>
    </Screen>
  );
}
