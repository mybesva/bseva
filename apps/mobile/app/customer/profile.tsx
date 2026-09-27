import { LANGS, toE164 } from "@bseva/config";
import { LANG_LABELS, type Lang } from "@bseva/locales";
import type { AuthUser } from "@bseva/types";
import { ApiError } from "@bseva/api-client";
import {
  parsePhoneParts,
  splitDisplayName,
  validatePersonNameParts,
  validatePhoneNational,
} from "@bseva/validation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, ScrollView, View, type ImageSourcePropType } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PhoneWithCountryCode } from "@/components/PhoneWithCountryCode";
import { MediaPicker, type PickedMedia } from "@/components/MediaPicker";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { clearCustomerProfilePhotoCache, fetchCustomerProfilePhotoSource } from "@/services/customerPhoto";
import { useAppTheme } from "@/theme/ThemeContext";
import { showSuccessAlert } from "@/utils/actionFeedback";
import { apiErrorMessage, userMessage } from "@/utils/userMessage";

function namePartsFromUser(
  account: (AuthUser & { first_name?: string | null; middle_name?: string | null; last_name?: string | null }) | null,
) {
  if (!account) return { first_name: "", middle_name: "", last_name: "" };
  const hasStructured =
    account.first_name != null || account.middle_name != null || account.last_name != null;
  if (hasStructured) {
    return {
      first_name: String(account.first_name ?? ""),
      middle_name: String(account.middle_name ?? ""),
      last_name: String(account.last_name ?? ""),
    };
  }
  return splitDisplayName(account.name);
}

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
  const [pendingPhoto, setPendingPhoto] = useState<PickedMedia | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNational, setPhoneNational] = useState("");
  const [lang, setLangState] = useState<Lang>((user?.preferred_language as Lang) || "en");
  const [photo, setPhoto] = useState<ImageSourcePropType | null>(null);
  const [photoOk, setPhotoOk] = useState(true);
  const [firstNameErrorKey, setFirstNameErrorKey] = useState<string | null>(null);
  const [lastNameErrorKey, setLastNameErrorKey] = useState<string | null>(null);
  const [phoneErrorKey, setPhoneErrorKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameFormDirty = useRef(false);
  const syncedUserId = useRef<string | null>(null);

  async function loadPhoto() {
    try {
      const src = await fetchCustomerProfilePhotoSource();
      setPhoto(src);
      setPhotoOk(Boolean(src));
    } catch (e: unknown) {
      setPhoto(null);
      setPhotoOk(false);
      if (e instanceof ApiError && e.status === 404) return;
      setError(apiErrorMessage(t, e, "mobile.uploadFailed"));
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    if (nameFormDirty.current && syncedUserId.current === user.id) return;
    const parts = namePartsFromUser(user);
    setFirstName(parts.first_name);
    setMiddleName(parts.middle_name);
    setLastName(parts.last_name);
    syncedUserId.current = user.id;
    nameFormDirty.current = false;
  }, [user?.id, user?.name, user?.first_name, user?.middle_name, user?.last_name]);

  useEffect(() => {
    const parsed = parsePhoneParts(user?.phone || "");
    setCountryCode(parsed.countryCode);
    setPhoneNational(parsed.national);
  }, [user?.phone]);

  useEffect(() => {
    if (user?.preferred_language) setLangState(user.preferred_language as Lang);
  }, [user?.preferred_language]);

  useFocusEffect(
    useCallback(() => {
      void loadPhoto();
    }, []),
  );

  const profileErr =
    profileQ.error instanceof ApiError && profileQ.error.status !== 404
      ? profileQ.error.message
      : null;

  const initial = (firstName || user?.name || "?").slice(0, 1).toUpperCase();
  const firstNameError = userMessage(t, firstNameErrorKey);
  const lastNameError = userMessage(t, lastNameErrorKey);
  const phoneError = userMessage(t, phoneErrorKey);

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
                    await clearCustomerProfilePhotoCache();
                    await loadPhoto();
                    void qc.invalidateQueries({ queryKey: ["customer-photo"] });
                    void qc.invalidateQueries({ queryKey: ["customer-profile"] });
                  } catch (e: unknown) {
                    setError(apiErrorMessage(t, e, "mobile.uploadFailed"));
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
                    await clearCustomerProfilePhotoCache();
                    setPhoto(null);
                    setPhotoOk(false);
                    void qc.invalidateQueries({ queryKey: ["customer-photo"] });
                  } catch (e: unknown) {
                    setError(apiErrorMessage(t, e, "mobile.saveFailed"));
                  }
                }}
              />
            </View>
          ) : null}
        </Card>
        <Card>
          <Field
            label={t("auth.firstName")}
            required
            value={firstName}
            onChangeText={(v) => {
              nameFormDirty.current = true;
              setFirstName(v);
              setFirstNameErrorKey(null);
            }}
            error={firstNameError}
            autoComplete="given-name"
          />
          <Field
            label={t("auth.middleName")}
            value={middleName}
            onChangeText={(v) => {
              nameFormDirty.current = true;
              setMiddleName(v);
            }}
            autoComplete="off"
          />
          <Field
            label={t("auth.lastName")}
            required
            value={lastName}
            onChangeText={(v) => {
              nameFormDirty.current = true;
              setLastName(v);
              setLastNameErrorKey(null);
            }}
            error={lastNameError}
            autoComplete="family-name"
          />
          <PhoneWithCountryCode
            label={t("auth.phone")}
            required
            countryCode={countryCode}
            national={phoneNational}
            onCountryCodeChange={(code) => {
              setCountryCode(code);
              setPhoneNational((prev) => prev.slice(0, code === "+91" ? 10 : 12));
              setPhoneErrorKey(null);
            }}
            onNationalChange={(digits) => {
              setPhoneNational(digits);
              setPhoneErrorKey(null);
            }}
            error={phoneError}
          />
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
              const nameParts = {
                first_name: firstName,
                middle_name: middleName,
                last_name: lastName,
              };
              const nErrs = validatePersonNameParts(nameParts);
              const phoneErrKey = validatePhoneNational(countryCode, phoneNational);
              setFirstNameErrorKey(nErrs.first_name ?? null);
              setLastNameErrorKey(nErrs.last_name ?? null);
              setPhoneErrorKey(phoneErrKey);
              if (Object.keys(nErrs).length || phoneErrKey) {
                setBusy(false);
                return;
              }
              try {
                const phone = toE164(countryCode, phoneNational);
                await apiClient.patchMe({
                  first_name: firstName.trim(),
                  middle_name: middleName.trim(),
                  last_name: lastName.trim(),
                  phone,
                  preferred_language: lang,
                });
                try {
                  await apiClient.patchCustomerProfile({ preferred_language: lang });
                } catch {
                  /* profile row may not exist yet */
                }
                nameFormDirty.current = false;
                setLang(lang);
                await refresh();
                void qc.invalidateQueries({ queryKey: ["customer-profile"] });
                showSuccessAlert(t("mobile.profileUpdated"));
              } catch (e: unknown) {
                setError(apiErrorMessage(t, e, "mobile.saveFailed"));
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
