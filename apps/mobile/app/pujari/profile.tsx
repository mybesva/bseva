import { PUJARI_QUALS, SAMPRADAYA_OPTS } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Image, ScrollView, Switch, View, type ImageSourcePropType } from "react-native";
import { MediaPicker } from "@/components/MediaPicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function PujariProfile() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["pujari-profile"], queryFn: () => apiClient.getPujariProfile() });
  const [p, setP] = useState<Record<string, unknown>>({});
  const [photo, setPhoto] = useState<ImageSourcePropType | null>(null);
  const [sign, setSign] = useState<ImageSourcePropType | null>(null);
  const [photoOk, setPhotoOk] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sameWa, setSameWa] = useState(false);

  async function loadMedia() {
    try {
      setPhoto(await apiClient.pujariMediaUri("photo"));
      setPhotoOk(true);
    } catch {
      setPhoto(null);
    }
    try {
      setSign(await apiClient.pujariMediaUri("signature"));
    } catch {
      setSign(null);
    }
  }

  useEffect(() => {
    if (!q.data) return;
    setP(q.data);
    setSameWa(!!q.data.mobile_number && q.data.mobile_number === q.data.whatsapp_number);
    void loadMedia();
  }, [q.data]);

  useEffect(() => {
    if (q.data || !user) return;
    setP((prev) => ({
      full_name: prev.full_name || user.name,
      mobile_number: prev.mobile_number || user.phone,
      ...((user.profile as Record<string, unknown> | null) || {}),
      ...prev,
    }));
  }, [user, q.data]);

  function set(key: string, value: unknown) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  if (q.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Profile" back />
        <LoadingBlock />
      </Screen>
    );
  }

  const quals = Array.isArray(p.qualifications) ? (p.qualifications as string[]) : [];
  const pct = Number(p.profile_completion_percentage || 0);

  return (
    <Screen>
      <ScreenHeader title="Pujari profile" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error || (q.isError ? (q.error instanceof Error ? q.error.message : "Could not load profile") : null)} />
        {q.isError ? (
          <PrimaryButton title="Retry" onPress={() => void q.refetch()} />
        ) : null}
        <AppText variant="small">
          Verification: {String(p.verification_status || p.profile_status || "—")} · {pct}% complete
        </AppText>
        {photo && photoOk ? (
          <Image
            source={photo}
            onError={() => setPhotoOk(false)}
            style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.secondary }}
          />
        ) : (
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: colors.secondary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AppText variant="h2" color={colors.primary}>
              {String(p.full_name || user?.name || "?").slice(0, 1).toUpperCase()}
            </AppText>
          </View>
        )}
        <Card>
          <AppText variant="h3">Photo</AppText>
          <MediaPicker
            onPicked={async (file) => {
              await apiClient.uploadPujariAsset("photo", file);
              setPhoto(await apiClient.pujariMediaUri("photo"));
              setPhotoOk(true);
            }}
          />
        </Card>
        <Card>
          <AppText variant="h3">Signature</AppText>
          {sign ? (
            <Image source={sign} style={{ width: "100%", height: 80, resizeMode: "contain", backgroundColor: colors.secondary }} />
          ) : null}
          <AppText variant="small">Take a photo of your signature or pick an image.</AppText>
          <MediaPicker
            cameraLabel="Photograph signature"
            onPicked={async (file) => {
              await apiClient.uploadPujariAsset("signature", file);
              setSign(await apiClient.pujariMediaUri("signature"));
            }}
          />
        </Card>
        <Field label="Full name" value={String(p.full_name || "")} onChangeText={(v) => set("full_name", v)} />
        <Field label="Father's name" value={String(p.father_name || "")} onChangeText={(v) => set("father_name", v)} />
        <Field label="Date of birth" value={String(p.date_of_birth || "").slice(0, 10)} onChangeText={(v) => set("date_of_birth", v)} />
        <Field label="Mobile" value={String(p.mobile_number || "")} onChangeText={(v) => set("mobile_number", v)} keyboardType="phone-pad" />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText>WhatsApp same as mobile</AppText>
          <Switch value={sameWa} onValueChange={setSameWa} />
        </View>
        {!sameWa ? (
          <Field label="WhatsApp" value={String(p.whatsapp_number || "")} onChangeText={(v) => set("whatsapp_number", v)} keyboardType="phone-pad" />
        ) : null}
        <Field label="Gotra" value={String(p.gotra || "")} onChangeText={(v) => set("gotra", v)} />
        <Field label="Pravara" value={String(p.pravara || "")} onChangeText={(v) => set("pravara", v)} />
        <Field label="Native place" value={String(p.native_place || "")} onChangeText={(v) => set("native_place", v)} />
        <Field label="Permanent address" value={String(p.permanent_address || "")} onChangeText={(v) => set("permanent_address", v)} />
        <Field label="Present address" value={String(p.present_address || "")} onChangeText={(v) => set("present_address", v)} />
        <AppText variant="small">Qualifications</AppText>
        <ChoiceChips multiple options={PUJARI_QUALS.map((x) => ({ id: x.id, label: x.label }))} value={quals} onChange={(v) => set("qualifications", v)} />
        <Field
          label="Qualification year"
          value={String(p.qualification_year || "")}
          onChangeText={(v) => set("qualification_year", Number(v) || undefined)}
          keyboardType="number-pad"
        />
        <ChoiceChips options={SAMPRADAYA_OPTS.map((s) => ({ id: s, label: s }))} value={String(p.sampradaya || "")} onChange={(v) => set("sampradaya", v)} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText style={{ flex: 1 }}>Allow listing on BSeva website</AppText>
          <Switch value={!!p.website_publication_consent} onValueChange={(v) => set("website_publication_consent", v)} />
        </View>
        <PrimaryButton
          title={busy ? "Saving..." : "Save"}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await apiClient.patchPujariProfile({
                full_name: p.full_name,
                father_name: p.father_name,
                gotra: p.gotra ?? "",
                pravara: p.pravara ?? "",
                date_of_birth: p.date_of_birth || null,
                native_place: p.native_place,
                permanent_address: p.permanent_address,
                present_address: p.present_address,
                mobile_number: p.mobile_number,
                whatsapp_number: sameWa ? p.mobile_number : p.whatsapp_number,
                qualifications: quals,
                qualification_year: p.qualification_year ? Number(p.qualification_year) : null,
                sampradaya: p.sampradaya || null,
                website_publication_consent: !!p.website_publication_consent,
              });
              await q.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed");
            } finally {
              setBusy(false);
            }
          }}
        />
      </ScrollView>
    </Screen>
  );
}
