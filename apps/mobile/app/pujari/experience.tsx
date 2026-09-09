import { PUJARI_LANGS, PUJARI_QUALS, PUJARI_SPECS, SAMPRADAYA_OPTS } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";

export default function ExperienceScreen() {
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
        <ScreenHeader title="Experience" back />
        <LoadingBlock />
      </Screen>
    );
  }
  return (
    <Screen>
      <ScreenHeader title="Experience" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Field label="Years of experience" value={years} onChangeText={setYears} keyboardType="number-pad" />
        <AppText variant="small">Qualifications</AppText>
        <ChoiceChips multiple options={PUJARI_QUALS.map((x) => ({ id: x.id, label: x.label }))} value={quals} onChange={(v) => setQuals(v as string[])} />
        <Field label="Qualification year" value={year} onChangeText={setYear} keyboardType="number-pad" />
        <AppText variant="small">Sampradaya</AppText>
        <ChoiceChips options={SAMPRADAYA_OPTS.map((s) => ({ id: s, label: s }))} value={sampradaya} onChange={(v) => setSampradaya(String(v))} />
        <AppText variant="small">Languages</AppText>
        <ChoiceChips multiple options={PUJARI_LANGS.map((s) => ({ id: s, label: s }))} value={langs} onChange={(v) => setLangs(v as string[])} />
        <AppText variant="small">Specializations</AppText>
        <ChoiceChips multiple options={PUJARI_SPECS.map((s) => ({ id: s, label: s }))} value={specs} onChange={(v) => setSpecs(v as string[])} />
        <PrimaryButton
          title="Save"
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
              await q.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed");
            }
          }}
        />
      </ScrollView>
    </Screen>
  );
}
