import { LANGS } from "@bseva/config";
import { LANG_LABELS, type Lang } from "@bseva/locales";
import { ApiError } from "@bseva/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Image, ScrollView, View, type ImageSourcePropType } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { MediaPicker } from "@/components/MediaPicker";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function CustomerProfile() {
  const { user, refresh } = useAuth();
  const { setLang, t } = useI18n();
  const { colors } = useAppTheme();
  const qc = useQueryClient();
  const profileQ = useQuery({
    queryKey: ["customer-profile"],
    queryFn: () => apiClient.getCustomerProfile() as Promise<Record<string, unknown>>,
    retry: false,
  });
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState(user?.phone || "");
  const [lang, setLangState] = useState<Lang>((user?.preferred_language as Lang) || "en");
  const [photo, setPhoto] = useState<ImageSourcePropType | null>(null);
  const [photoOk, setPhotoOk] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadPhoto() {
    try {
      const src = await apiClient.customerPhotoUri();
      setPhoto(src);
      setPhotoOk(true);
    } catch {
      setPhoto(null);
    }
  }

  useEffect(() => {
    if (user?.phone) setPhone(user.phone);
    if (user?.first_name || user?.last_name || user?.middle_name) {
      setFirstName(String(user.first_name || ""));
      setMiddleName(String(user.middle_name || ""));
      setLastName(String(user.last_name || ""));
    } else if (user?.name) {
      const parts = user.name.trim().split(/\s+/).filter(Boolean);
      setFirstName(parts[0] || "");
      setMiddleName(parts.length > 2 ? parts.slice(1, -1).join(" ") : "");
      setLastName(parts.length > 1 ? parts[parts.length - 1] : "");
    }
    if (user?.preferred_language) setLangState(user.preferred_language as Lang);
  }, [user?.name, user?.phone, user?.preferred_language, user?.first_name, user?.middle_name, user?.last_name]);

  useEffect(() => {
    void loadPhoto();
  }, []);

  const profileErr =
    profileQ.error instanceof ApiError && profileQ.error.status !== 404
      ? profileQ.error.message
      : null;

  const initial = (firstName || user?.name || "?").slice(0, 1).toUpperCase();

  return (
    <Screen>
      <ScreenHeader title={t("mobile.profile")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <ErrorBanner message={error || profileErr} />
        <Card>
          <AppText variant="small" color={colors.mutedForeground} style={{ marginBottom: 8 }}>
            {t("web.customerProfile.photo")} ({t("common.optional")})
          </AppText>
          {photo && photoOk ? (
            <Image
              source={photo}
              onError={() => setPhotoOk(false)}
              style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 12, backgroundColor: colors.secondary }}
            />
          ) : (
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: colors.secondary,
                marginBottom: 12,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText variant="h2" color={colors.primary}>
                {initial}
              </AppText>
            </View>
          )}
          <MediaPicker
            onPicked={async (file) => {
              setError(null);
              try {
                await apiClient.uploadCustomerPhoto(file);
                await loadPhoto();
                void qc.invalidateQueries({ queryKey: ["customer-photo"] });
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : t("mobile.uploadFailed"));
              }
            }}
          />
          {photo && photoOk ? (
            <View style={{ marginTop: 8 }}>
              <PrimaryButton
                title={t("mobile.removePhoto")}
                variant="outline"
                onPress={async () => {
                  setError(null);
                  try {
                    await apiClient.deleteCustomerPhoto();
                    setPhoto(null);
                    void qc.invalidateQueries({ queryKey: ["customer-photo"] });
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : t("mobile.saveFailed"));
                  }
                }}
              />
            </View>
          ) : null}
        </Card>
        <Card>
          <Field label={t("auth.firstName")} value={firstName} onChangeText={setFirstName} />
          <Field label={t("auth.middleName")} value={middleName} onChangeText={setMiddleName} />
          <Field label={t("auth.lastName")} value={lastName} onChangeText={setLastName} />
          <Field label={t("auth.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <AppText variant="small" color={colors.mutedForeground} style={{ marginTop: 8 }}>
            {user?.email || "—"}
          </AppText>
          <AppText variant="small" style={{ marginTop: 12, marginBottom: 8 }}>
            {t("mobile.language")}
          </AppText>
          <ChoiceChips
            options={LANGS.map((code) => ({ id: code, label: LANG_LABELS[code] }))}
            value={lang}
            onChange={(v) => setLangState(v as Lang)}
          />
          <View style={{ height: 12 }} />
          <PrimaryButton
            title={busy ? t("mobile.saving") : t("mobile.save")}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                await apiClient.patchMe({
                  first_name: firstName.trim(),
                  middle_name: middleName.trim(),
                  last_name: lastName.trim(),
                  phone: phone.trim() || undefined,
                  preferred_language: lang,
                });
                try {
                  await apiClient.patchCustomerProfile({ preferred_language: lang });
                } catch {
                  /* profile row may not exist yet */
                }
                setLang(lang);
                await refresh();
                void qc.invalidateQueries({ queryKey: ["customer-profile"] });
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : t("mobile.saveFailed"));
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
