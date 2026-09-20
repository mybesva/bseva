import { matchesPujariJobSegment, PUJARI_JOB_SEGMENTS, rupees, type PujariJobSegment } from "@bseva/config";
import type { Booking } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PujaTitle } from "@/components/PujaTitle";
import { AppText, Card, ChoiceChips, EmptyState, Field, LoadingBlock, Screen, StatusBadge } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { formatDisplaySlot } from "@/utils/formatDate";
import { useI18n } from "@/providers/I18nProvider";

export default function PujariJobs() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { t } = useI18n();
  const [segment, setSegment] = useState<PujariJobSegment>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qtext, setQtext] = useState("");
  const q = useQuery({ queryKey: ["bookings"], queryFn: () => apiClient.listBookings() });
  const rows = useMemo(() => {
    const needle = qtext.trim().toLowerCase();
    return [...(q.data || [])]
      .filter((b) => matchesPujariJobSegment(segment, b.status, b.booking_date, b.start_time))
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
        const da = `${a.booking_date || ""}T${a.start_time || "00:00:00"}`;
        const db = `${b.booking_date || ""}T${b.start_time || "00:00:00"}`;
        return da.localeCompare(db);
      });
  }, [q.data, segment, from, to, qtext]);
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">{t("mobile.jobs")}</AppText>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
      >
        <ChoiceChips
          options={PUJARI_JOB_SEGMENTS.map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) }))}
          value={segment}
          onChange={(v) => setSegment(String(v) as PujariJobSegment)}
        />
        <Field label="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} />
        <Field label="To (YYYY-MM-DD)" value={to} onChangeText={setTo} />
        <Field label="Search" value={qtext} onChangeText={setQtext} />
        {q.isLoading ? <LoadingBlock /> : null}
        {rows.length === 0 ? <EmptyState title={t("mobile.noJobs")} /> : null}
        {rows.map((b: Booking) => (
          <Pressable key={b.id} onPress={() => router.push(`/pujari/booking/${b.id}`)}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <PujaTitle name={b.service_name} variant="h3" style={{ flex: 1 }} />
                <StatusBadge status={b.status} />
              </View>
              <AppText variant="small" color={colors.mutedForeground}>
                {b.customer_name} · {formatDisplaySlot(b.booking_date, b.start_time)}
              </AppText>
              <AppText>{rupees(b.pujari_payable_paise || 0)}</AppText>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
