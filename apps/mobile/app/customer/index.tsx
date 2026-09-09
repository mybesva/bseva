import { CALENDARS, rupees } from "@bseva/config";
import type { Booking, CatalogService } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, ChoiceChips, EmptyState, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function CustomerHome() {
  const { user, refresh } = useAuth();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const calendar = String(user?.calendar_preference || "north");
  const bookings = useQuery({ queryKey: ["bookings"], queryFn: () => apiClient.listBookings() });
  const services = useQuery({ queryKey: ["services"], queryFn: () => apiClient.listServices() });
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => apiClient.getWallet() as Promise<{ wallet?: { balance_paise?: number }; balance_paise?: number }> });
  const panchang = useQuery({ queryKey: ["panchang", today, calendar], queryFn: () => apiClient.panchang(today, calendar) as Promise<Record<string, unknown>> });
  const recs = useQuery({ queryKey: ["recommendations"], queryFn: () => apiClient.recommendations() });
  const ongoing = (bookings.data || []).filter((b) => b.status === "in_progress");
  const upcoming = (bookings.data || []).filter((b) => ["pending", "pending_acceptance", "confirmed"].includes(b.status)).slice(0, 3);
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
        <Card>
          <AppText variant="small">Panchang · {today}</AppText>
          <ChoiceChips
            options={CALENDARS.map((c) => ({ id: c, label: c }))}
            value={calendar}
            onChange={(v) => {
              void apiClient.patchMe({ calendar_preference: v }).then(() => refresh());
            }}
          />
          <AppText variant="small" color={colors.mutedForeground} style={{ marginTop: 8 }}>
            {String(panchang.data?.tithi || panchang.data?.summary || panchang.data?.nakshatra || "Today’s panchang loads from the server.")}
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
                    <StatusBadge status={b.status} />
                  </View>
                  <AppText variant="small" color={colors.mutedForeground}>
                    #{b.booking_number} · {b.booking_date}
                  </AppText>
                </Card>
              </Pressable>
            ))}
          </>
        ) : null}
        {upcoming.length > 0 ? (
          <>
            <AppText variant="h2">Upcoming</AppText>
            {upcoming.map((b: Booking) => (
              <Pressable key={b.id} onPress={() => router.push(`/customer/booking/${b.id}`)}>
                <Card>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <AppText variant="h3">{b.service_name}</AppText>
                    <StatusBadge status={b.status} />
                  </View>
                  <AppText variant="small">{b.booking_date} {b.start_time}</AppText>
                </Card>
              </Pressable>
            ))}
          </>
        ) : null}
        {recItems.length > 0 ? (
          <>
            <AppText variant="h2">Recommended</AppText>
            {recItems.slice(0, 5).map((item, i) => {
              const rec = item as { title?: string; name?: string; service_slug?: string; slug?: string };
              return (
                <Pressable key={i} onPress={() => rec.service_slug || rec.slug ? router.push(`/service/${rec.service_slug || rec.slug}`) : undefined}>
                  <Card>
                    <AppText>{rec.title || rec.name || "Recommended puja"}</AppText>
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
                {s.standard_price_paise != null ? `${t("customer.from")} ${rupees(s.standard_price_paise)}` : "Available soon"}
              </AppText>
            </Card>
          </Pressable>
        ))}
        {(services.data || []).length === 0 && !services.isLoading ? (
          <EmptyState title={t("customer.noBookings")} subtitle="Browse services to book a puja." />
        ) : null}
        <PrimaryButton title="View all services" variant="outline" onPress={() => router.push("/customer/services")} />
      </ScrollView>
    </Screen>
  );
}
