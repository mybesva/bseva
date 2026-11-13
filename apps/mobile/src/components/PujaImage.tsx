import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CatalogService } from "@bseva/types";
import { rupees } from "@bseva/config";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { AppText, Card, PrimaryButton } from "@/components/ui";
import { formatPujaTitleText } from "@bseva/locales";
import { PujaTitle } from "@/components/PujaTitle";
import { useI18n } from "@/providers/I18nProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "expo-router";

type Svc = { slug?: string; image_url?: string | null; image_path?: string | null; service_type?: string | null };

function useServicePhoto(service: Svc | string) {
  const key = typeof service === "string" ? service : `${service.slug || ""}|${service.image_url || ""}|${service.image_path || ""}|${service.service_type || ""}`;
  const candidates = useMemo(() => apiClient.serviceImageCandidates(service), [key]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
  }, [key]);
  const uri = candidates[index];
  return {
    uri,
    onError: () => setIndex((i) => (i + 1 <= candidates.length ? i + 1 : i)),
    failed: !uri || index >= candidates.length,
  };
}

export function PujaImage({
  service,
  style,
  imageStyle,
  height = 180,
}: {
  service: Svc | string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  height?: number;
}) {
  const { colors } = useAppTheme();
  const photo = useServicePhoto(service);
  if (photo.failed || !photo.uri) {
    return (
      <View
        style={[
          { height, width: "100%", borderRadius: 12, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
          style,
        ]}
      >
        <Ionicons name="flame" size={28} color={colors.primary} />
      </View>
    );
  }
  return (
    <View
      style={[
        {
          width: "100%",
          aspectRatio: 16 / 9,
          height: undefined,
          minHeight: height,
          borderRadius: 12,
          backgroundColor: colors.secondary,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Image
        source={{ uri: photo.uri }}
        resizeMode="contain"
        onError={photo.onError}
        style={[{ width: "100%", height: "100%" }, imageStyle]}
      />
    </View>
  );
}

export function PujaThumb({ service, size = 64 }: { service: Svc | string; size?: number }) {
  const { colors } = useAppTheme();
  const photo = useServicePhoto(service);
  if (photo.failed || !photo.uri) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: colors.primary + "22",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="flame" size={22} color={colors.primary} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: photo.uri }}
      resizeMode="cover"
      onError={photo.onError}
      style={{ width: size, height: size, borderRadius: 12, backgroundColor: colors.secondary }}
    />
  );
}

export function PujaServiceCard({
  service,
  onPress,
}: {
  service: CatalogService;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  // Same rule as the service page: guests sign in first, customers go straight to booking.
  const bookNow = () => {
    if (!user) router.push({ pathname: "/login", params: { role: "customer" } });
    else router.push(`/customer/book/${service.slug}`);
  };
  return (
    // Orange outline so each puja card stands apart from the next one in a long list.
    <Card style={{ padding: 0, overflow: "hidden", borderWidth: 1.5, borderColor: colors.primary }}>
      {/* Image, title, price and description open the service page; Book Now sits outside this tap area. */}
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={formatPujaTitleText(service.name)}>
        <PujaImage service={service} height={168} imageStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} />
        <View style={{ paddingHorizontal: 12, paddingTop: 12, gap: 4 }}>
          <PujaTitle name={service.name} />
          {/* Same order and wording as the website card: price, then description with Read More. */}
          {service.standard_price_paise != null ? (
            <AppText color={colors.primary} style={{ fontWeight: "700" }}>
              {t("services.startingFrom")} {rupees(service.standard_price_paise)}
            </AppText>
          ) : (
            <AppText variant="small" style={{ fontWeight: "700" }} color={colors.mutedForeground}>
              {t("services.comingSoonLabel")}
            </AppText>
          )}
          {service.short_description || service.description ? (
            <View style={{ gap: 2 }}>
              <AppText variant="small" color={colors.mutedForeground} numberOfLines={2}>
                {service.short_description || service.description}
              </AppText>
              <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8} style={{ alignSelf: "flex-start" }}>
                <AppText variant="small" color={colors.primary} style={{ fontWeight: "700" }}>
                  {t("services.readMore")}
                </AppText>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 8 }}>
        {/* Book straight from the card, like the website card, so nobody has to open and scroll the service page. */}
        {service.bookable ? (
          <PrimaryButton title={t("customer.bookNow")} onPress={bookNow} />
        ) : service.standard_price_paise != null ? (
          // Priced but not bookable yet: the website card shows "Coming Soon" in the button's place.
          <AppText
            variant="small"
            color={colors.warning}
            style={{ textAlign: "center", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            {t("services.comingSoonLabel")}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}
