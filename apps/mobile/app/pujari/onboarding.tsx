import {
  PRIVACY_VERSION,
  PUJARI_DOC_TYPES,
  PUJARI_FINAL_CONSENT_LABEL,
  PUJARI_LANGS,
  PUJARI_QUALS,
  PUJARI_SPECS,
  SAMPRADAYA_OPTS,
  TERMS_VERSION,
} from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, ScrollView, Switch, View, type ImageSourcePropType } from "react-native";
import { AddressForm, type AddressFormValue } from "@/components/AddressForm";
import { MediaPicker } from "@/components/MediaPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type Profile = Record<string, unknown>;

export default function PujariOnboarding() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState<ImageSourcePropType | null>(null);
  const docs = useQuery({ queryKey: ["pujari-docs"], queryFn: () => apiClient.pujariDocuments() });

  async function load() {
    const p = await apiClient.getPujariProfile();
    if (p.profile_submitted_at) {
      router.replace("/pujari");
      return;
    }
    setProfile(p);
    setStep(Math.min(6, Math.max(1, Number(p.onboarding_step || 1))));
    setConsent(!!p.final_submission_consent);
    if (p.profile_photo_path) setPhoto(await apiClient.pujariMediaUri("photo"));
  }

  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);

  function set(key: string, value: unknown) {
    setProfile((p) => ({ ...(p || {}), [key]: value }));
  }

  async function saveStep(next: number, extra: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.patchPujariProfile({ ...extra, onboarding_step: next });
      setProfile(updated);
      setStep(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!profile) {
    return (
      <Screen>
        <ScreenHeader title="Onboarding" back />
        <LoadingBlock />
      </Screen>
    );
  }

  const quals = Array.isArray(profile.qualifications) ? (profile.qualifications as string[]) : [];
  const langs = Array.isArray(profile.languages) ? (profile.languages as string[]) : [];
  const specs = Array.isArray(profile.specializations) ? (profile.specializations as string[]) : [];
  const addr: AddressFormValue = {
    address_line1: String(profile.address_line1 || ""),
    address_line2: String(profile.address_line2 || ""),
    city: String(profile.city || ""),
    district: String(profile.district || ""),
    state: String(profile.state || ""),
    pincode: String(profile.pincode || ""),
    country: String(profile.country || "India"),
    location_label: String(profile.location_label || ""),
    latitude: profile.latitude != null ? Number(profile.latitude) : undefined,
    longitude: profile.longitude != null ? Number(profile.longitude) : undefined,
  };

  return (
    <Screen>
      <ScreenHeader title={`Onboarding ${step}/6`} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} />
        <AppText variant="small">{Number(profile.profile_completion_percentage || 0)}% complete</AppText>
        {String(profile.joining_fee_status) === "pending" ? (
          <PrimaryButton title="Pay joining fee from wallet" onPress={() => void apiClient.payJoiningFee().then(load).catch((e) => setError(e.message))} />
        ) : null}

        {step === 1 ? (
          <>
            {photo ? <Image source={photo} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.secondary }} /> : null}
            <MediaPicker
              onPicked={async (file) => {
                await apiClient.uploadPujariAsset("photo", file);
                setPhoto(await apiClient.pujariMediaUri("photo"));
              }}
            />
            <Field label="Full name" value={String(profile.full_name || "")} onChangeText={(v) => set("full_name", v)} />
            <Field label="Date of birth (YYYY-MM-DD)" value={String(profile.date_of_birth || "").slice(0, 10)} onChangeText={(v) => set("date_of_birth", v)} />
            <Field label="Mobile" value={String(profile.mobile_number || "")} onChangeText={(v) => set("mobile_number", v)} keyboardType="phone-pad" />
            <Field label="Gotra" value={String(profile.gotra || "")} onChangeText={(v) => set("gotra", v)} />
            <Field label="Pravara" value={String(profile.pravara || "")} onChangeText={(v) => set("pravara", v)} />
            <PrimaryButton
              title={busy ? "Saving..." : "Save & continue"}
              loading={busy}
              onPress={() =>
                void saveStep(2, {
                  full_name: profile.full_name,
                  date_of_birth: profile.date_of_birth || null,
                  mobile_number: profile.mobile_number,
                  gotra: profile.gotra || null,
                  pravara: profile.pravara || null,
                })
              }
            />
          </>
        ) : null}

        {step === 2 ? (
          <AddressForm
            value={addr}
            onChange={(next) => setProfile((p) => ({ ...(p || {}), ...next }))}
            busy={busy}
            onSave={async (parsed) => {
              await saveStep(3, {
                ...parsed,
                present_address: [parsed.address_line1, parsed.city, parsed.state, parsed.pincode].filter(Boolean).join(", "),
              });
            }}
          />
        ) : null}

        {step === 3 ? (
          <>
            <Field label="Years of experience" value={String(profile.experience_years || "")} onChangeText={(v) => set("experience_years", Number(v) || 0)} keyboardType="number-pad" />
            <AppText variant="small">Qualifications</AppText>
            <ChoiceChips multiple options={PUJARI_QUALS.map((q) => ({ id: q.id, label: q.label }))} value={quals} onChange={(v) => set("qualifications", v)} />
            <Field label="Qualification year" value={String(profile.qualification_year || "")} onChangeText={(v) => set("qualification_year", Number(v) || undefined)} keyboardType="number-pad" />
            <AppText variant="small">Sampradaya</AppText>
            <ChoiceChips options={SAMPRADAYA_OPTS.map((s) => ({ id: s, label: s }))} value={String(profile.sampradaya || "")} onChange={(v) => set("sampradaya", v)} />
            <AppText variant="small">Languages</AppText>
            <ChoiceChips multiple options={PUJARI_LANGS.map((s) => ({ id: s, label: s }))} value={langs} onChange={(v) => set("languages", v)} />
            <AppText variant="small">Specializations</AppText>
            <ChoiceChips multiple options={PUJARI_SPECS.map((s) => ({ id: s, label: s }))} value={specs} onChange={(v) => set("specializations", v)} />
            <PrimaryButton title="Back" variant="outline" onPress={() => setStep(2)} />
            <PrimaryButton
              title={busy ? "Saving..." : "Save & continue"}
              loading={busy}
              onPress={() =>
                void saveStep(4, {
                  experience_years: Number(profile.experience_years) || 0,
                  qualifications: quals,
                  qualification_year: profile.qualification_year ? Number(profile.qualification_year) : null,
                  sampradaya: profile.sampradaya || null,
                  languages: langs,
                  specializations: specs,
                })
              }
            />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <AppText>Upload Aadhaar (identity) before final submit. Camera is available on mobile.</AppText>
            {(docs.data || []).map((d) => (
              <Card key={d.id}>
                <AppText>{d.document_type}</AppText>
                {d.status ? <StatusBadge status={String(d.status)} /> : null}
              </Card>
            ))}
            {PUJARI_DOC_TYPES.map((t) => (
              <Card key={t.id}>
                <AppText variant="h3">{t.label}</AppText>
                <MediaPicker
                  allowFile
                  onPicked={async (file) => {
                    await apiClient.uploadPujariDocument(file, t.id);
                    await docs.refetch();
                  }}
                />
              </Card>
            ))}
            <PrimaryButton title="Back" variant="outline" onPress={() => setStep(3)} />
            <PrimaryButton title="Continue" onPress={() => void saveStep(5, {})} />
          </>
        ) : null}

        {step === 5 ? (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <AppText>Available for bookings</AppText>
              <Switch value={!!profile.available} onValueChange={(v) => set("available", v)} />
            </View>
            <Field label="Service radius (km)" value={String(profile.service_radius_km || "")} onChangeText={(v) => set("service_radius_km", Number(v) || 0)} keyboardType="number-pad" />
            <Field label="Account holder" value={String(profile.bank_holder_name || "")} onChangeText={(v) => set("bank_holder_name", v)} />
            <Field label="IFSC" value={String(profile.bank_ifsc || "")} onChangeText={(v) => set("bank_ifsc", v)} autoCapitalize="characters" />
            <Field label="Account last 4" value={String(profile.bank_account_last4 || "")} onChangeText={(v) => set("bank_account_last4", v)} keyboardType="number-pad" maxLength={4} />
            <PrimaryButton title="Back" variant="outline" onPress={() => setStep(4)} />
            <PrimaryButton
              title={busy ? "Saving..." : "Save & continue"}
              loading={busy}
              onPress={() =>
                void saveStep(6, {
                  available: !!profile.available,
                  service_radius_km: profile.service_radius_km ? Number(profile.service_radius_km) : null,
                  bank_account_last4: profile.bank_account_last4 || null,
                  bank_ifsc: profile.bank_ifsc || null,
                  bank_holder_name: profile.bank_holder_name || null,
                })
              }
            />
          </>
        ) : null}

        {step === 6 ? (
          <>
            <Card>
              <AppText variant="h3">{String(profile.full_name)}</AppText>
              <AppText variant="small">{String(profile.city)} · {String(profile.sampradaya)}</AppText>
              <AppText variant="small">Level requested {String(profile.requested_level || "—")}</AppText>
            </Card>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
              <Switch value={consent} onValueChange={setConsent} />
              <AppText variant="small" style={{ flex: 1 }}>
                {PUJARI_FINAL_CONSENT_LABEL}
              </AppText>
            </View>
            <PrimaryButton title="Back" variant="outline" onPress={() => setStep(5)} />
            <PrimaryButton
              title={busy ? "Submitting..." : "Submit for verification"}
              loading={busy}
              onPress={async () => {
                if (!consent) {
                  setError("Consent is required");
                  return;
                }
                setBusy(true);
                setError(null);
                try {
                  await apiClient.patchPujariProfile({ onboarding_step: 6 });
                  await apiClient.submitPujariProfile({
                    final_submission_consent: true,
                    terms_version: TERMS_VERSION,
                    privacy_version: PRIVACY_VERSION,
                  });
                  router.replace("/pujari");
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Submit failed");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
