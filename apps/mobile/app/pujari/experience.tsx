import { PUJARI_LANGS, PUJARI_QUALS, PUJARI_SPECS, SAMPRADAYA_OPTS } from "@bseva/config";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

export default function ExperienceScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pujari-profile"], queryFn: () => apiClient.getPujariProfile() });
  const [years, setYears] = useState("");
  const [year, setYear] = useState("");
  const [sampradaya, setSampradaya] = useState("");
  const [quals, setQuals] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>([]);
  const [specs, setSpecs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!q.data) return;
    setYears(q.data.experience_years != null ? String(q.data.experience_years) : "");
    setYear(q.data.qualification_year != null ? String(q.data.qualification_year) : "");
    setSampradaya(String(q.data.sampradaya || ""));
    setQuals(Array.isArray(q.data.qualifications) ? (q.data.qualifications as string[]) : []);
    setLangs(Array.isArray(q.data.languages) ? (q.data.languages as string[]) : []);
    setSpecs(Array.isArray(q.data.specializations) ? (q.data.specializations as string[]) : []);
  }, [q.data]);
  if (q.isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t("mobile.experience")} back />
        <LoadingBlock />
      </Screen>
    );
  }
  return (
    <Screen>
      <ScreenHeader title={t("mobile.experience")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Field label={t("mobile.yearsExperience")} value={years} onChangeText={setYears} keyboardType="number-pad" />
        <AppText variant="small">{t("mobile.qualifications")}</AppText>
        <ChoiceChips multiple options={PUJARI_QUALS.map((x) => ({ id: x.id, label: x.label }))} value={quals} onChange={(v) => setQuals(v as string[])} />
        <Field label={t("mobile.qualificationYear")} value={year} onChangeText={setYear} keyboardType="number-pad" />
        <AppText variant="small">{t("mobile.sampradaya")}</AppText>
        <ChoiceChips options={SAMPRADAYA_OPTS.map((s) => ({ id: s, label: s }))} value={sampradaya} onChange={(v) => setSampradaya(String(v))} />
        <AppText variant="small">{t("mobile.languages")}</AppText>
        <ChoiceChips multiple options={PUJARI_LANGS.map((s) => ({ id: s, label: s }))} value={langs} onChange={(v) => setLangs(v as string[])} />
        <AppText variant="small">{t("mobile.specializations")}</AppText>
        <ChoiceChips multiple options={PUJARI_SPECS.map((s) => ({ id: s, label: s }))} value={specs} onChange={(v) => setSpecs(v as string[])} />
        <PrimaryButton
          title={t("mobile.save")}
          onPress={async () => {
            setError(null);
            try {
              await apiClient.patchPujariProfile({
                experience_years: Number(years) || 0,
                qualifications: quals,
                qualification_year: year ? Number(year) : null,
                sampradaya,
                languages: langs,
                specializations: specs,
              });
              await qc.invalidateQueries({ queryKey: ["pujari-profile"] });
              Alert.alert(t("mobile.experienceUpdated"));
              router.back();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : t("mobile.failed"));
            }
          }}
        />
      </ScrollView>
    </Screen>
  );
}
