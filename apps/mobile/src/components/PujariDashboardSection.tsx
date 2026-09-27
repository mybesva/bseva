import type { Booking } from "@bseva/types";
import { useRouter, type Href } from "expo-router";
import { useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { PujariDashboardBookingCard } from "@/components/PujariDashboardBookingCard";
import { AppText } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { PUJARI_DASHBOARD_FEATURED_LIMIT } from "@/utils/pujariBookings";

export function PujariDashboardSection({
  title,
  bookings,
  viewAllHref,
  emptyText,
  featured = false,
  cardVariant = featured ? "featured" : "compact",
}: {
  title: string;
  bookings: Booking[];
  viewAllHref?: Href;
  emptyText?: string;
  featured?: boolean;
  cardVariant?: "compact" | "featured" | "request";
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const cardWidth = width - 32;
  const preview = bookings.slice(0, PUJARI_DASHBOARD_FEATURED_LIMIT);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  if (bookings.length === 0 && !emptyText) return null;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / cardWidth);
    setActiveIndex(Math.max(0, Math.min(idx, preview.length - 1)));
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <AppText variant="h2" color={colors.navy} style={{ flex: 1 }}>
          {title}
        </AppText>
        {viewAllHref ? (
          <Pressable
            onPress={() => router.push(viewAllHref)}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, minHeight: 44, justifyContent: "center" })}
          >
            <AppText color={colors.primary} style={{ fontWeight: "700", fontSize: 13 }}>
              {t("common.viewAll")} ›
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {bookings.length === 0 && emptyText ? (
        <AppText variant="small" color={colors.mutedForeground}>
          {emptyText}
        </AppText>
      ) : null}

      {featured && cardVariant === "featured" && preview.length > 1 ? (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={cardWidth}
            contentContainerStyle={{ gap: 0 }}
          >
            {preview.map((booking) => (
              <View key={booking.id} style={{ width: cardWidth }}>
                <PujariDashboardBookingCard booking={booking} variant={cardVariant} />
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
            {preview.map((booking, i) => (
              <View
                key={booking.id}
                style={{
                  width: i === activeIndex ? 8 : 6,
                  height: i === activeIndex ? 8 : 6,
                  borderRadius: 4,
                  backgroundColor: i === activeIndex ? colors.primary : colors.border,
                }}
              />
            ))}
          </View>
        </>
      ) : (
        preview.map((booking) => (
          <PujariDashboardBookingCard key={booking.id} booking={booking} variant={cardVariant} />
        ))
      )}
    </View>
  );
}
