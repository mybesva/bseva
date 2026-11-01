import { Ionicons } from "@expo/vector-icons";
import { rupees } from "@bseva/config";
import type { Booking } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PujaTitle } from "@/components/PujaTitle";
import { AppText, StatusBadge } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { formatDisplayDate, formatDisplaySlot } from "@/utils/formatDate";

const NAVY = "#071A33";
const SAFFRON = "#FF7A00";
const GOLD = "#D4AF37";

export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="h2" style={{ flex: 1, fontSize: 18 }}>
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="link" hitSlop={8}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const QUICK: { key: string; labelKey: string; icon: keyof typeof Ionicons.glyphMap; href: string; bg: string }[] = [
  { key: "book", labelKey: "nav.bookPuja", icon: "flower-outline", href: "/customer/services", bg: SAFFRON },
  { key: "bookings", labelKey: "nav.bookings", icon: "calendar-outline", href: "/customer/bookings", bg: "#0D2445" },
  { key: "seva", labelKey: "seva.mySeva", icon: "sparkles-outline", href: "/customer/(tabs)/bookings", bg: "#C65D3B" },
  { key: "sankalp", labelKey: "seva.familySankalp", icon: "people-outline", href: "/customer/family-sankalp", bg: "#1B7A4A" },
];

export function CustomerQuickActions() {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <View style={styles.quickRow}>
      {QUICK.map((q) => (
        <Pressable
          key={q.key}
          onPress={() => router.push(q.href as never)}
          accessibilityRole="button"
          accessibilityLabel={t(q.labelKey)}
          style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.75 }]}
        >
          <View style={[styles.quickIcon, { backgroundColor: q.bg }]}>
            <Ionicons name={q.icon} size={24} color="#FFFFFF" />
          </View>
          <AppText variant="small" style={styles.quickLabel} numberOfLines={2}>
            {t(q.labelKey)}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

/** Puja happening now (or within the start window) with the Start Puja OTP when the Pujari is assigned. */
export function OngoingPujaCard({ booking }: { booking: Booking }) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const b = booking as Booking & { pujari_id?: string | null; location_label?: string | null };
  const wantsOtp = b.status === "confirmed" && Boolean(b.pujari_id);
  const otp = useQuery({
    queryKey: ["start-otp", b.id],
    queryFn: () => apiClient.getStartOtp(String(b.id)),
    enabled: wantsOtp,
    refetchInterval: 30_000,
  });
  const code = otp.data?.available && otp.data.code ? String(otp.data.code) : null;

  return (
    <Pressable
      onPress={() => router.push(`/customer/booking/${b.id}`)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={styles.ongoingIcon}>
          <Ionicons name="flame-outline" size={28} color={SAFFRON} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ alignSelf: "flex-start" }}>
            <StatusBadge status={String(b.customer_display_status || b.status)} />
          </View>
          <PujaTitle name={b.service_name} variant="h3" />
          <AppText variant="small" color={colors.mutedForeground}>
            #{b.booking_number} · {formatDisplaySlot(b.booking_date, b.start_time ? String(b.start_time).slice(0, 5) : null)}
          </AppText>
          {b.location_label ? (
            <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
              {b.location_label}
            </AppText>
          ) : null}
        </View>
      </View>
      {wantsOtp ? (
        <View style={styles.otpBox}>
          {code ? (
            <View style={{ flexDirection: "row", gap: 5 }}>
              {code.split("").map((ch, i) => (
                <View key={i} style={styles.otpDigit}>
                  <Text style={styles.otpDigitText}>{ch}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.otpTitle}>{t("otp.startTitle").toUpperCase()}</Text>
            <Text style={styles.otpHint}>{code ? t("otp.startShare") : otp.data?.message || t("track.notAvailable")}</Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

export function UpcomingList({ bookings }: { bookings: Booking[] }) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const showPujariNote = bookings.some(
    (b) => !b.pujari_details_visible && !["cancelled", "refunded", "completed"].includes(String(b.status)),
  );
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: 6 }]}>
      {bookings.map((b, i) => {
        const d = b.booking_date ? new Date(`${String(b.booking_date).slice(0, 10)}T00:00:00`) : null;
        const day = d && !Number.isNaN(d.getTime()) ? String(d.getDate()) : "—";
        const mon = d && !Number.isNaN(d.getTime()) ? d.toLocaleString("en-US", { month: "short" }).toUpperCase() : "";
        return (
          <Pressable
            key={b.id}
            onPress={() => router.push(`/customer/booking/${b.id}`)}
            style={[styles.upRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
          >
            <View style={styles.dateTile}>
              <Text style={styles.dateDay}>{day}</Text>
              <Text style={styles.dateMon}>{mon}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <PujaTitle name={b.service_name} variant="h3" numberOfLines={1} />
              <AppText variant="small" color={colors.mutedForeground}>
                {b.start_time ? String(b.start_time).slice(0, 5) : formatDisplayDate(b.booking_date)}
              </AppText>
            </View>
            <StatusBadge status={String(b.customer_display_status || b.status)} />
          </Pressable>
        );
      })}
      {showPujariNote ? (
        <AppText variant="small" color={colors.mutedForeground} style={{ paddingBottom: 8, paddingTop: 2 }}>
          {t("booking.pujariSharedLater")}
        </AppText>
      ) : null}
    </View>
  );
}

type Rec = {
  id?: string | number;
  title?: string;
  name?: string;
  description?: string;
  recurrence_hint?: string;
  service_name?: string;
  service_slug?: string;
  slug?: string;
  standard_price_paise?: number | null;
  price_paise?: number | null;
};

export function RecommendedRail({ items }: { items: unknown[] }) {
  const { t } = useI18n();
  const { colors, theme } = useAppTheme();
  const router = useRouter();
  const isDark = theme === "dark";
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
      {items.slice(0, 5).map((raw, i) => {
        const rec = raw as Rec;
        const slug = rec.service_slug || rec.slug;
        const price = rec.standard_price_paise ?? rec.price_paise ?? null;
        return (
          <Pressable
            key={String(rec.id ?? i)}
            disabled={!slug}
            onPress={() => (slug ? router.push(`/service/${slug}`) : undefined)}
            style={[
              styles.recCard,
              { backgroundColor: isDark ? "rgba(255,122,0,0.1)" : "#FFF6EC", borderColor: isDark ? "rgba(255,122,0,0.3)" : "#FFD9B3" },
            ]}
          >
            {rec.recurrence_hint ? (
              <Text style={styles.recHint} numberOfLines={1}>
                {rec.recurrence_hint}
              </Text>
            ) : null}
            <AppText variant="h3" numberOfLines={2} style={{ fontSize: 15 }}>
              {rec.title || rec.name || t("mobile.recommendedPuja")}
            </AppText>
            {rec.description ? (
              <AppText variant="small" color={colors.mutedForeground} numberOfLines={2}>
                {rec.description}
              </AppText>
            ) : null}
            <View style={styles.recFoot}>
              <Text style={styles.recPrice}>{price != null ? `${t("customer.from")} ${rupees(price)}` : ""}</Text>
              <View style={styles.recBtn}>
                <Text style={styles.recBtnText}>{t("customer.bookNow")}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  sectionAction: { color: SAFFRON, fontWeight: "800", fontSize: 13 },
  quickRow: { flexDirection: "row", gap: 8 },
  quickItem: { flex: 1, alignItems: "center", gap: 7 },
  quickIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  quickLabel: { textAlign: "center", fontWeight: "700", fontSize: 11.5, lineHeight: 15 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  ongoingIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#FFF1E2",
    alignItems: "center",
    justifyContent: "center",
  },
  otpBox: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: NAVY, padding: 12 },
  otpDigit: {
    width: 30,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.55)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  otpDigitText: { color: "#FFFFFF", fontSize: 19, fontWeight: "800" },
  otpTitle: { color: SAFFRON, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 2 },
  otpHint: { color: "rgba(255,255,255,0.78)", fontSize: 11, lineHeight: 15 },
  upRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  dateTile: {
    width: 48,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#FFF1E2",
    alignItems: "center",
    justifyContent: "center",
  },
  dateDay: { color: SAFFRON, fontSize: 18, fontWeight: "800", lineHeight: 20 },
  dateMon: { color: "#4A5770", fontSize: 10, fontWeight: "800" },
  recCard: { width: 220, borderRadius: 18, borderWidth: 1, padding: 13, gap: 6 },
  recHint: {
    alignSelf: "flex-start",
    color: "#C25E00",
    backgroundColor: "#FFE6CC",
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  recFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 6 },
  recPrice: { color: SAFFRON, fontWeight: "800", fontSize: 12, flexShrink: 1 },
  recBtn: { backgroundColor: SAFFRON, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  recBtnText: { color: "#0E1830", fontWeight: "800", fontSize: 11 },
});

export { GOLD, NAVY, SAFFRON };
