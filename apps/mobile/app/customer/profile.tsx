import { LANGS } from "@bseva/config";
import { LANG_LABELS, type Lang } from "@bseva/locales";
import type { AuthUser } from "@bseva/types";
import { ApiError } from "@bseva/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Image, ScrollView, View, type ImageSourcePropType } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { MediaPicker, type PickedMedia } from "@/components/MediaPicker";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { fetchCustomerProfilePhotoSource } from "@/services/customerPhoto";
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
  const [fullName, setFullName] = useState(user?.name || "");
  const [pendingPhoto, setPendingPhoto] = useState<PickedMedia | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
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
      const src = await fetchCustomerProfilePhotoSource();
      setPhoto(src);
      setPhotoOk(Boolean(src));
    } catch (e: unknown) {
      setPhoto(null);
      setPhotoOk(false);
      if (e instanceof ApiError && e.status === 404) return;
      setError(e instanceof Error ? e.message : t("mobile.uploadFailed"));
    }
  }

  useEffect(() => {
    const account = user as (AuthUser & {
      first_name?: string | null;
      middle_name?: string | null;
      last_name?: string | null;
    }) | null;
    if (account?.name) setFullName(account.name);
    if (account?.phone) setPhone(account.phone);
    if (account?.first_name || account?.last_name || account?.middle_name) {
      setFirstName(String(account.first_name || ""));
      setMiddleName(String(account.middle_name || ""));
      setLastName(String(account.last_name || ""));
    } else if (account?.name) {
      const parts = account.name.trim().split(/\s+/).filter(Boolean);
      setFirstName(parts[0] || "");
      setMiddleName(parts.length > 2 ? parts.slice(1, -1).join(" ") : "");
      setLastName(parts.length > 1 ? parts[parts.length - 1] : "");
    }
    if (account?.preferred_language) setLangState(account.preferred_language as Lang);
  }, [user]);

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
          {pendingPhoto ? (
            <View style={{ gap: 8, marginBottom: 8 }}>
              <Image source={{ uri: pendingPhoto.uri }} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.secondary }} />
              <AppText variant="small">{t("mobile.photoConfirmHelp")}</AppText>
              <PrimaryButton
                title={photoBusy ? t("mobile.saving") : t("mobile.uploadPhoto")}
                loading={photoBusy}
                onPress={async () => {
                  setPhotoBusy(true);
                  setError(null);
                  try {
                    const updated = (await apiClient.uploadCustomerPhoto(pendingPhoto)) as {
                      profile_photo_path?: string | null;
                    };
                    setPendingPhoto(null);
                    setError(null);
                    if (!updated?.profile_photo_path?.trim()) {
                      throw new Error(t("mobile.uploadFailed"));
                    }
                    setPhoto(await apiClient.customerPhotoUri());
                    setPhotoOk(true);
                    void qc.invalidateQueries({ queryKey: ["customer-photo"] });
                    void qc.invalidateQueries({ queryKey: ["customer-profile"] });
                    await loadPhoto();
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : t("mobile.uploadFailed"));
                  } finally {
                    setPhotoBusy(false);
                  }
                }}
              />
              <PrimaryButton title={t("common.cancel")} variant="outline" disabled={photoBusy} onPress={() => setPendingPhoto(null)} />
            </View>
          ) : (
            <MediaPicker aspect={[1, 1]} onPicked={(file) => setPendingPhoto(file)} />
          )}
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
          <Field label={t("mobile.name")} value={fullName} onChangeText={setFullName} />
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
                const composed = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(" ");
                let saveFirst = firstName.trim();
                let saveMiddle = middleName.trim();
                let saveLast = lastName.trim();
                if (fullName.trim() && fullName.trim() !== composed) {
                  const parts = fullName.trim().split(/\s+/).filter(Boolean);
                  saveFirst = parts[0] || "";
                  saveLast = parts.length > 1 ? parts[parts.length - 1] : saveLast;
                  saveMiddle = parts.length > 2 ? parts.slice(1, -1).join(" ") : "";
                }
                await apiClient.patchMe({
                  first_name: saveFirst,
                  middle_name: saveMiddle,
                  last_name: saveLast,
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
