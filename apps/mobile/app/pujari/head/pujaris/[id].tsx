import { TOKEN_KEY } from "@bseva/tokens";
import { useQuery } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system";
import { useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { apiClient, resolveApiBase } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type Details = {
  public_id?: string | null;
  profile: Record<string, unknown>;
  documents: { id: string; document_type: string; status?: string | null }[];
  verification_history: { action: string; created_at: string; actor_name?: string | null }[];
};
type Offers = { verified_services?: { name?: string }[]; pending_review_services?: { name?: string }[] };

const words = (value: unknown) =>
  Array.isArray(value) ? value.join(", ") : value == null || value === "" ? null : String(value);
const label = (value: string) => value.replace(/_/g, " ");

function Row({ name, value }: { name: string; value: unknown }) {
  const { colors } = useAppTheme();
  const text = words(value);
  if (!text) return null;
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="small" color={colors.mutedForeground}>
        {name}
      </AppText>
      <AppText>{text}</AppText>
    </View>
  );
}

/** Read-only details. There are deliberately no approve, reject or edit actions here. */
export default function HeadPujariDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const [error, setError] = useState<string | null>(null);
  const details = useQuery({
    queryKey: ["head-pujari", id],
    queryFn: () => apiClient.api<Details>(`/head/pujari-directory/${id}`),
    enabled: !!id,
  });
  const offers = useQuery({
    queryKey: ["head-pujari-services", id],
    queryFn: () => apiClient.api<Offers>(`/head/pujari-directory/${id}/service-offers`),
    enabled: !!id,
  });

  async function openDocument(docId: string, type: string) {
    setError(null);
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const target = `${FileSystem.cacheDirectory}${docId}-${type}`;
      const out = await FileSystem.downloadAsync(
        `${resolveApiBase()}/api/v1/head/pujari-directory/${id}/documents/${docId}/file`,
        target,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (out.status !== 200) throw new Error("Could not open this document");
      await Sharing.shareAsync(out.uri);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not open this document");
    }
  }

  const data = details.data;
  const p = data?.profile || {};
  const services = (list?: { name?: string }[]) => (list || []).map((s) => s.name).filter(Boolean);
  return (
    <Screen>
      <ScreenHeader title="Pujari details" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <ErrorBanner message={error || (details.error instanceof Error ? details.error.message : null)} />
        {details.isLoading ? <LoadingBlock /> : null}
        {data ? (
          <>
            <Card style={{ gap: 8 }}>
              <AppText variant="h3">{String(p.full_name || p.name || "")}</AppText>
              <StatusBadge status={String(p.verification_status || "pending")} />
              <Row name="Pujari ID" value={data.public_id} />
              <AppText variant="small" color={colors.mutedForeground}>
                Read-only view. Only Admin can verify or change a pujari. Contact Admin for any action.
              </AppText>
            </Card>
            <Card style={{ gap: 8 }}>
              <AppText variant="h3">Contact and location</AppText>
              <Row name="Phone" value={p.phone || p.mobile_number} />
              <Row name="Email" value={p.email} />
              <Row name="Address" value={p.address || p.location_label} />
              <Row name="City" value={p.city} />
              <Row name="District" value={p.district} />
              <Row name="State" value={p.state} />
              <Row name="Service radius (km)" value={p.service_radius_km} />
            </Card>
            <Card style={{ gap: 8 }}>
              <AppText variant="h3">Profile</AppText>
              <Row name="Experience (years)" value={p.experience_years} />
              <Row name="Languages" value={p.languages} />
              <Row name="Specializations" value={p.specializations} />
              <Row name="Requested level" value={p.requested_level} />
              <Row name="Approved level" value={p.approved_level} />
              <Row name="Profile completion" value={`${p.profile_completion_percentage ?? 0}%`} />
            </Card>
            <Card style={{ gap: 8 }}>
              <AppText variant="h3">Services</AppText>
              <Row name="Verified" value={services(offers.data?.verified_services)} />
              <Row name="Waiting for review" value={services(offers.data?.pending_review_services)} />
            </Card>
            <Card style={{ gap: 8 }}>
              <AppText variant="h3">Documents</AppText>
              {data.documents.length === 0 ? <AppText color={colors.mutedForeground}>No documents yet.</AppText> : null}
              {data.documents.map((doc) => (
                <PrimaryButton
                  key={doc.id}
                  variant="outline"
                  title={`View ${label(doc.document_type)}`}
                  onPress={() => void openDocument(doc.id, doc.document_type)}
                />
              ))}
            </Card>
            <Card style={{ gap: 8 }}>
              <AppText variant="h3">Verification history</AppText>
              {data.verification_history.length === 0 ? <AppText color={colors.mutedForeground}>No history yet.</AppText> : null}
              {data.verification_history.map((row, i) => (
                <Row key={`${row.created_at}-${i}`} name={new Date(row.created_at).toLocaleString("en-IN")} value={`${label(row.action)} by ${row.actor_name || "System"}`} />
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
