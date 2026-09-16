import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";
import { useState } from "react";

type OfferService = {
  id: string;
  name: string;
  slug?: string;
  applied?: boolean;
  catalog_price_paise?: number;
  short_description?: string | null;
};

type OffersPayload = {
  services?: OfferService[];
  applied_count?: number;
  note?: string;
};

export default function PujariServicesScreen() {
  const { colors } = useAppTheme();
  const { t, lang } = useI18n();
  const profile = useQuery({ queryKey: ["pujari-profile"], queryFn: () => apiClient.getPujariProfile() });
  const roles = useQuery({
    queryKey: ["pujari-roles"],
    queryFn: () => apiClient.pujariRoles() as Promise<{ level: number; title: string; summary?: string }[]>,
  });
  const offers = useQuery({
    queryKey: ["pujari-offers", lang],
    queryFn: () => apiClient.pujariServiceOffers() as Promise<OffersPayload>,
  });
  const approved = Number(profile.data?.approved_level || 0);
  const [level, setLevel] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const rows = Array.isArray(roles.data) ? roles.data : [];
  const services = (offers.data?.services || []).filter((s) =>
    !q.trim() ? true : s.name.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <Screen>
      <ScreenHeader title={t("mobile.serviceOffers")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}>
        <ErrorBanner message={error} />
        <AppText variant="h3">{t("mobile.capableServices")}</AppText>
        <Field label={t("mobile.search")} value={q} onChangeText={setQ} />
        {offers.data?.note ? <AppText variant="small">{offers.data.note}</AppText> : null}
        {services.map((s) => (
          <Card key={s.id}>
            <AppText variant="h3">{s.name}</AppText>
            {s.short_description ? (
              <AppText variant="small" color={colors.mutedForeground}>
                {s.short_description}
              </AppText>
            ) : null}
            {s.catalog_price_paise ? <AppText variant="small">{rupees(s.catalog_price_paise)}</AppText> : null}
            {s.applied ? (
              <AppText variant="small" color={colors.success}>
                {t("mobile.applied")}
              </AppText>
            ) : (
              <PrimaryButton
                title={applying === s.id ? t("common.loading") : t("mobile.applyService")}
                loading={applying === s.id}
                onPress={async () => {
                  setApplying(s.id);
                  setError(null);
                  try {
                    await apiClient.applyPujariServiceOffer(s.id);
                    await offers.refetch();
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : t("mobile.couldNotApplyService"));
                  } finally {
                    setApplying(null);
                  }
                }}
              />
            )}
          </Card>
        ))}

        <View style={{ height: 8 }} />
        <AppText variant="h3">{t("mobile.upgradeRole")}</AppText>
        <AppText>{t("mobile.approvedLevel", { level: approved || "—" })}</AppText>
        <AppText>{t("mobile.requestedLevel", { level: String(profile.data?.requested_level || "—") })}</AppText>
        {rows.map((r) => (
          <Pressable key={r.level} onPress={() => r.level > approved && setLevel(r.level)}>
            <Card style={{ borderWidth: level === r.level ? 2 : 0.5, borderColor: level === r.level ? colors.primary : colors.border }}>
              <AppText variant="h3">
                {t("mobile.levelTitle", { level: r.level, title: r.title })}
              </AppText>
              <AppText variant="small">{r.summary}</AppText>
              {r.level <= approved ? <AppText variant="small">{t("mobile.alreadyLevel")}</AppText> : null}
            </Card>
          </Pressable>
        ))}
        <PrimaryButton
          title={t("mobile.requestLevel")}
          onPress={async () => {
            if (!level) {
              setError(t("mobile.selectHigherLevel"));
              return;
            }
            setError(null);
            try {
              await apiClient.applyPujariLevel(level);
              await profile.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : t("mobile.failed"));
            }
          }}
        />
      </ScrollView>
    </Screen>
  );
}
