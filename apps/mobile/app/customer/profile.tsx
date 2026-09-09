import { LANGS } from "@bseva/config";
import { LANG_LABELS, type Lang } from "@bseva/locales";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { MediaPicker } from "@/components/MediaPicker";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function CustomerProfile() {
  const { user, refresh } = useAuth();
  const { setLang } = useI18n();
  const { colors } = useAppTheme();
  const qc = useQueryClient();
  useQuery({ queryKey: ["customer-profile"], queryFn: () => apiClient.getCustomerProfile() });
  const [name, setName] = useState(user?.name || "");
  const [lang, setLangState] = useState<Lang>((user?.preferred_language as Lang) || "en");
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadPhoto() {
    setPhoto(await apiClient.customerPhotoUri());
  }

  useEffect(() => {
    void loadPhoto();
  }, []);

  return (
    <Screen>
      <ScreenHeader title="Profile" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Card>
          {photo ? (
            <Image source={{ uri: photo }} style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 12, backgroundColor: colors.secondary }} />
          ) : (
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.secondary, marginBottom: 12 }} />
          )}
          <MediaPicker
            onPicked={async (file) => {
              setError(null);
              try {
                await apiClient.uploadCustomerPhoto(file);
                await loadPhoto();
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Upload failed");
              }
            }}
          />
        </Card>
        <Card>
          <Field label="Name" value={name} onChangeText={setName} />
          <AppText variant="small" color={colors.mutedForeground} style={{ marginTop: 8 }}>
            {user?.email} · {user?.phone}
          </AppText>
          <AppText variant="small" style={{ marginTop: 12, marginBottom: 8 }}>
            Language
          </AppText>
          <ChoiceChips
            options={LANGS.map((code) => ({ id: code, label: LANG_LABELS[code] }))}
            value={lang}
            onChange={(v) => setLangState(v as Lang)}
          />
          <View style={{ height: 12 }} />
          <PrimaryButton
            title={busy ? "Saving..." : "Save"}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                await apiClient.patchMe({ name, preferred_language: lang });
                try {
                  await apiClient.patchCustomerProfile({ preferred_language: lang });
                } catch {
                  /* profile row may not exist yet */
                }
                setLang(lang);
                await refresh();
                void qc.invalidateQueries({ queryKey: ["customer-profile"] });
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Save failed");
              } finally {
                setBusy(false);
              }
            }}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
