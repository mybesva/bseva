import { formatIndianPhone } from "@bseva/config";
import { Linking, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton } from "@/components/ui";
import { PhoneWithCountryCode } from "@/components/PhoneWithCountryCode";
import { apiClient } from "@/services/api";
import { useAuth } from "@/providers/AuthProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";
import { apiErrorMessage } from "@/utils/userMessage";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Errs = Partial<Record<"name" | "email" | "phone" | "subject" | "message", string>>;

export function CustomerContactPanel() {
  const { t } = useI18n();
  const config = useQuery({ queryKey: ["public-config"], queryFn: () => apiClient.publicConfig() });
  const data = config.data || {};
  const phone = String(data.bseva_whatsapp_number || data.support_phone || "");
  const email = String(data.email_from_support || data.support_email || "");
  const digits = phone.replace(/[^\d+]/g, "");
  const [name, setName] = useState("");
  const [mail, setMail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobile, setMobile] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<Errs>({});
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const { colors } = useAppTheme();

  // Signed-in users don't retype what we already know.
  useEffect(() => {
    if (!user) return;
    setName((v) => v || String(user.name || ""));
    setMail((v) => v || String(user.email || ""));
    const digitsOnly = String(user.phone || "").replace(/\D/g, "");
    if (digitsOnly) setMobile((v) => v || digitsOnly.slice(-10));
  }, [user]);

  const clear = (k: keyof Errs) => setErrs((e) => ({ ...e, [k]: undefined }));

  function validate(): Errs {
    const next: Errs = {};
    if (name.trim().length < 2) next.name = t("contact.errName");
    if (!EMAIL_RE.test(mail.trim())) next.email = t("contact.errEmail");
    const phoneDigits = mobile.replace(/\D/g, "");
    if (countryCode === "+91") {
      if (!/^[6-9]\d{9}$/.test(phoneDigits)) next.phone = t("contact.errPhoneIndia");
    } else if (phoneDigits.length < 8 || phoneDigits.length > 12) next.phone = t("contact.errPhoneIntl");
    if (subject.trim().length < 3) next.subject = t("contact.errSubject");
    if (message.trim().length < 10) next.message = t("contact.errMessage");
    return next;
  }

  return (
    <View style={{ gap: 12 }}>
      {config.isLoading ? <LoadingBlock /> : null}
      <ErrorBanner message={error} />
      <Card style={{ gap: 10 }}>
        {phone ? (
          <>
            <AppText variant="small">{t("contact.phone")}</AppText>
            <PrimaryButton title={formatIndianPhone(phone)} onPress={() => void Linking.openURL(`tel:+${digits.replace(/^\+/, "")}`)} />
            <PrimaryButton title={t("mobile.whatsapp")} variant="outline" onPress={() => void Linking.openURL(`https://wa.me/${digits.replace(/^\+/, "")}`)} />
          </>
        ) : null}
        {email ? (
          <>
            <AppText variant="small" style={{ marginTop: phone ? 6 : 0 }}>{t("contact.email")}</AppText>
            <PrimaryButton title={email} variant="outline" onPress={() => void Linking.openURL(`mailto:${email}`)} />
          </>
        ) : null}
      </Card>
      <Card style={{ gap: 10 }}>
        <AppText variant="h3">{t("contact.sendMessage")}</AppText>
        {sent ? <AppText>{t("contact.sent")}</AppText> : null}
        <AppText variant="small" color={colors.mutedForeground}>
          {t("contact.requiredNote")}
        </AppText>
        <Field required label={t("auth.name")} value={name} onChangeText={(v) => { setName(v); clear("name"); }} error={errs.name} />
        <Field
          required
          label={t("auth.email")}
          value={mail}
          onChangeText={(v) => { setMail(v); clear("email"); }}
          autoCapitalize="none"
          keyboardType="email-address"
          error={errs.email}
        />
        <PhoneWithCountryCode
          required
          label={t("auth.phone")}
          countryCode={countryCode}
          national={mobile}
          onCountryCodeChange={(v) => { setCountryCode(v); clear("phone"); }}
          onNationalChange={(v) => { setMobile(v); clear("phone"); }}
          error={errs.phone}
        />
        <Field required label={t("contact.subject")} value={subject} onChangeText={(v) => { setSubject(v); clear("subject"); }} error={errs.subject} />
        <Field
          required
          label={t("contact.message")}
          value={message}
          onChangeText={(v) => { setMessage(v); clear("message"); }}
          multiline
          error={errs.message}
        />
        <PrimaryButton
          title={busy ? t("mobile.submitting") : t("contact.send")}
          loading={busy}
          onPress={async () => {
            setError(null);
            const next = validate();
            setErrs(next);
            if (Object.values(next).some(Boolean)) return;
            setBusy(true);
            try {
              await apiClient.contactMessage({
                name: name.trim(),
                email: mail.trim(),
                country_code: countryCode,
                phone: mobile.replace(/\D/g, ""),
                subject: subject.trim(),
                message: message.trim(),
              });
              setSent(true);
              setMessage("");
            } catch (e: unknown) {
              setError(apiErrorMessage(t, e, "mobile.failed"));
            } finally {
              setBusy(false);
            }
          }}
        />
      </Card>
    </View>
  );
}
