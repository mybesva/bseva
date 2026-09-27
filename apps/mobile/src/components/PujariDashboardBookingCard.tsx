import { rupees } from "@bseva/config";
import type { Booking } from "@bseva/types";
import { formatTime } from "@bseva/locales";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { PujaThumb } from "@/components/PujaImage";
import { PujaTitle } from "@/components/PujaTitle";
import { AppText, Card, PrimaryButton, StatusBadge } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { formatHumanDate } from "@/utils/formatDate";
import { bookingLocationLabel } from "@/utils/pujariBookings";

type ActionKind = "accept_reject" | "start_otp" | "none";

function cardActionKind(booking: Booking): ActionKind {
  if (["pending", "pending_acceptance"].includes(String(booking.status || ""))) return "accept_reject";
  if (booking.status === "confirmed") return "start_otp";
  return "none";
}

function CompactAction({
  title,
  onPress,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "destructive";
}) {
  const { colors } = useAppTheme();
  const bg =
    variant === "primary" ? colors.primary : variant === "destructive" ? colors.destructive : "transparent";
  const fg =
    variant === "outline" ? colors.primary : variant === "destructive" ? colors.destructiveForeground : colors.primaryForeground;
  const border = variant === "outline" ? colors.border : "transparent";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 44,
        borderRadius: 8,
        borderWidth: variant === "outline" ? 1 : 0,
        borderColor: border,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 10,
        paddingVertical: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <AppText variant="small" color={fg} style={{ fontWeight: "700", textAlign: "center" }}>
        {title}
      </AppText>
    </Pressable>
  );
}

function BookingMetaBadge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" | "premium" }) {
  const { colors } = useAppTheme();
  const bg = tone === "accent" ? "#FFF0E0" : tone === "premium" ? "#F0EBF8" : colors.secondary;
  const fg = tone === "accent" ? "#C45C2D" : tone === "premium" ? "#6B4FA0" : colors.mutedForeground;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
      <AppText variant="small" color={fg} style={{ fontSize: 10, fontWeight: "700" }}>
        {label}
      </AppText>
    </View>
  );
}

function FeaturedBookingCard({ booking }: { booking: Booking }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { colors } = useAppTheme();
  const location = bookingLocationLabel(booking);
  const dakshina = rupees(Number(booking.pujari_payable_paise || booking.total_paise || 0));
  const actionKind = cardActionKind(booking);
  const openDetail = () => router.push(`/pujari/booking/${booking.id}`);
  const dateLabel = formatHumanDate(booking.booking_date);
  const timeLabel = formatTime(booking.start_time, lang);
  const serviceRef = booking.service_slug || booking.service_id || booking.service_name || "";
  const isVirtual = String(booking.mode || "").toLowerCase() === "virtual";
  const packageType = String(booking.package_type || "").toLowerCase();

  return (
    <Card style={{ padding: 14, gap: 10, borderColor: colors.border + "55" }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <PujaThumb service={serviceRef} size={72} />
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
            <PujaTitle name={booking.service_name} variant="h3" style={{ flex: 1, fontWeight: "700" }} numberOfLines={2} />
            <StatusBadge status={booking.status} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {booking.samagri_requested ? <BookingMetaBadge label={t("pujari.dashboard.samagriSelected")} tone="accent" /> : null}
            {isVirtual ? <BookingMetaBadge label={t("mobile.virtual")} /> : null}
            {!isVirtual ? <BookingMetaBadge label={t("mobile.inPerson")} /> : null}
            {packageType === "premium" ? <BookingMetaBadge label={t("mobile.premium")} tone="premium" /> : null}
          </View>
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} />
          <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
            {dateLabel}
            {timeLabel ? `, ${timeLabel}` : ""}
          </AppText>
        </View>
        {location ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
            <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
              {location}
            </AppText>
          </View>
        ) : null}
        <AppText variant="small" color={colors.primary} style={{ fontWeight: "700" }}>
          {t("mobile.dakshinaLabel", { amount: dakshina })}
        </AppText>
      </View>

      <PrimaryButton title={`${t("pujari.dashboard.viewDetails")} ›`} onPress={openDetail} />

      {actionKind === "accept_reject" ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <CompactAction title={t("mobile.acceptShort")} onPress={openDetail} />
          <CompactAction title={t("mobile.reject")} onPress={openDetail} variant="outline" />
        </View>
      ) : null}

      {actionKind === "start_otp" ? <CompactAction title={t("mobile.startWithOtp")} onPress={openDetail} /> : null}
    </Card>
  );
}

function RequestBookingCard({ booking }: { booking: Booking }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { colors } = useAppTheme();
  const location = bookingLocationLabel(booking);
  const dakshina = rupees(Number(booking.pujari_payable_paise || booking.total_paise || 0));
  const openDetail = () => router.push(`/pujari/booking/${booking.id}`);
  const dateLabel = formatHumanDate(booking.booking_date);
  const timeLabel = formatTime(booking.start_time, lang);
  const serviceRef = booking.service_slug || booking.service_id || booking.service_name || "";
  const isVirtual = String(booking.mode || "").toLowerCase() === "virtual";
  const packageType = String(booking.package_type || "").toLowerCase();
  const extraPujaris = Number(booking.additional_pujaris_required ?? 0);

  return (
    <Card style={{ padding: 12, gap: 8, borderColor: colors.border + "55" }}>
      <Pressable onPress={openDetail} accessibilityRole="button">
        <View style={{ flexDirection: "row", gap: 10 }}>
          <PujaThumb service={serviceRef} size={56} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
              <PujaTitle name={booking.service_name} variant="h3" style={{ flex: 1, fontWeight: "700" }} numberOfLines={2} />
              <StatusBadge status={booking.status} />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              {booking.samagri_requested ? (
                <BookingMetaBadge label={t("pujari.dashboard.samagriSelected")} tone="accent" />
              ) : null}
              {isVirtual ? <BookingMetaBadge label={t("mobile.virtual")} /> : null}
              {!isVirtual ? <BookingMetaBadge label={t("mobile.inPerson")} /> : null}
              {packageType === "premium" ? <BookingMetaBadge label={t("mobile.premium")} tone="premium" /> : null}
              {packageType === "standard" ? <BookingMetaBadge label={t("mobile.standard")} /> : null}
              {extraPujaris > 0 ? (
                <BookingMetaBadge label={t("pujari.dashboard.pujarisRequired", { count: String(extraPujaris + 1) })} />
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>

      <View style={{ gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
          <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
            {dateLabel}
            {timeLabel ? `, ${timeLabel}` : ""}
          </AppText>
        </View>
        {location ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
            <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
              {location}
            </AppText>
          </View>
        ) : null}
        <AppText variant="small" color={colors.primary} style={{ fontWeight: "700" }}>
          {t("mobile.dakshinaLabel", { amount: dakshina })}
        </AppText>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <CompactAction title={t("priest.reject")} onPress={openDetail} variant="outline" />
        <CompactAction title={t("mobile.acceptShort")} onPress={openDetail} />
      </View>
    </Card>
  );
}

function CompactBookingCard({ booking }: { booking: Booking }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { colors } = useAppTheme();
  const location = bookingLocationLabel(booking);
  const dakshina = rupees(Number(booking.pujari_payable_paise || booking.total_paise || 0));
  const actionKind = cardActionKind(booking);
  const openDetail = () => router.push(`/pujari/booking/${booking.id}`);

  return (
    <Card style={{ padding: 12, gap: 8 }}>
      <Pressable onPress={openDetail} accessibilityRole="button">
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <PujaTitle name={booking.service_name} variant="h3" style={{ flexShrink: 1 }} numberOfLines={2} />
              {booking.samagri_requested ? (
                <View
                  style={{
                    backgroundColor: colors.secondary,
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <AppText variant="small" color={colors.mutedForeground} style={{ fontSize: 10, fontWeight: "700" }}>
                    {t("mobile.samagri")}
                  </AppText>
                </View>
              ) : null}
            </View>
            <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
              {formatHumanDate(booking.booking_date)}
              {booking.start_time ? ` · ${formatTime(booking.start_time, lang)}` : ""}
            </AppText>
            {location ? (
              <AppText variant="small" color={colors.mutedForeground} numberOfLines={1}>
                {location}
              </AppText>
            ) : null}
            <AppText variant="small" color={colors.foreground} style={{ fontWeight: "600" }}>
              {t("mobile.dakshinaLabel", { amount: dakshina })}
            </AppText>
          </View>
          <StatusBadge status={booking.status} />
        </View>
      </Pressable>

      {actionKind === "accept_reject" ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
          <CompactAction title={t("mobile.acceptShort")} onPress={openDetail} />
          <CompactAction title={t("mobile.reject")} onPress={openDetail} variant="outline" />
        </View>
      ) : null}

      {actionKind === "start_otp" ? <CompactAction title={t("mobile.startWithOtp")} onPress={openDetail} /> : null}
    </Card>
  );
}

export function PujariDashboardBookingCard({
  booking,
  variant = "compact",
}: {
  booking: Booking;
  variant?: "compact" | "featured" | "request";
}) {
  if (variant === "featured") return <FeaturedBookingCard booking={booking} />;
  if (variant === "request") return <RequestBookingCard booking={booking} />;
  return <CompactBookingCard booking={booking} />;
}
