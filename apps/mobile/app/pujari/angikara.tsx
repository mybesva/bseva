import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Image, ScrollView, Switch, View, type ImageSourcePropType } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function AngikaraScreen() {
  const { colors } = useAppTheme();
  const q = useQuery({
    queryKey: ["angikara"],
    queryFn: () => apiClient.getAngikara() as Promise<{ status?: string; profile?: Record<string, unknown>; document?: { status?: string } }>,
  });
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<ImageSourcePropType | null>(null);
  const [sign, setSign] = useState<ImageSourcePropType | null>(null);
  const profile = q.data?.profile || {};
  const status = q.data?.document?.status || q.data?.status || String(profile.angikara_status || "not_started");
  const locked = status === "submitted" || status === "approved";

  useEffect(() => {
    void (async () => {
      if (profile.profile_photo_path) setPhoto(await apiClient.pujariMediaUri("photo"));
      if (profile.signature_path) setSign(await apiClient.pujariMediaUri("signature"));
    })();
  }, [profile.profile_photo_path, profile.signature_path]);

  return (
    <Screen>
      <ScreenHeader title="Angikara Patram" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Card>
          <AppText variant="h3">Status: {status}</AppText>
          {photo ? <Image source={photo} style={{ width: 72, height: 72, borderRadius: 36, marginTop: 8, backgroundColor: colors.secondary }} /> : null}
          <AppText>{String(profile.full_name || "")}</AppText>
          <AppText variant="small">Father: {String(profile.father_name || "—")}</AppText>
          <AppText variant="small">Gotra {String(profile.gotra || "—")} · Pravara {String(profile.pravara || "—")}</AppText>
          <AppText variant="small">DOB {String(profile.date_of_birth || "").slice(0, 10)}</AppText>
          <AppText variant="small">{String(profile.present_address || profile.permanent_address || "")}</AppText>
          <AppText variant="small">{String(profile.mobile_number || "")}</AppText>
          <AppText variant="small">{String(profile.sampradaya || "")} · {String((profile.qualifications as string[] | undefined)?.join(", ") || "")}</AppText>
          {sign ? <Image source={sign} style={{ width: "100%", height: 70, resizeMode: "contain", marginTop: 8 }} /> : null}
        </Card>
        {locked ? (
          <AppText>This Angikara Patram is locked after submission.</AppText>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Switch value={agree} onValueChange={setAgree} />
              <AppText style={{ flex: 1 }}>I confirm this information is accurate and submit Angikara Patram.</AppText>
            </View>
            <PrimaryButton
              title="Submit Angikara"
              onPress={async () => {
                if (!agree) {
                  setError("Please confirm first");
                  return;
                }
                setError(null);
                try {
                  await apiClient.patchPujariProfile({ website_publication_consent: true });
                  await apiClient.submitAngikara({ accepted: true });
                  await q.refetch();
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Failed");
                }
              }}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
