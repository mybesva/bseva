import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CatalogService } from "@bseva/types";
import { rupees } from "@bseva/config";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { AppText, Card } from "@/components/ui";
import { PujaTitle } from "@/components/PujaTitle";
import { useI18n } from "@/providers/I18nProvider";

type Svc = { slug?: string; image_url?: string | null; image_path?: string | null };

function useServicePhoto(service: Svc | string) {
  const key = typeof service === "string" ? service : `${service.slug || ""}|${service.image_url || ""}|${service.image_path || ""}`;
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
    <Image
      source={{ uri: photo.uri }}
      resizeMode="cover"
      onError={photo.onError}
      style={[{ width: "100%", height, borderRadius: 12, backgroundColor: colors.secondary }, imageStyle]}
    />
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
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={service.name}>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <PujaImage service={service} height={168} imageStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} />
        <View style={{ padding: 12, gap: 4 }}>
          <PujaTitle name={service.name} />
          {service.short_description || service.description ? (
            <AppText variant="small" color={colors.mutedForeground} numberOfLines={2}>
              {service.short_description || service.description}
            </AppText>
          ) : null}
          {service.standard_price_paise != null ? (
            <AppText color={colors.primary} style={{ fontWeight: "700", marginTop: 2 }}>
              {t("customer.from")} {rupees(service.standard_price_paise)}
            </AppText>
          ) : (
            <AppText variant="small" color={colors.mutedForeground}>
              {t("services.comingSoonLabel")}
            </AppText>
          )}
        </View>
      </Card>
    </Pressable>
  );
}
