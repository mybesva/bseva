import { contactSchema } from "@bseva/validation";
import { PHONE_COUNTRY_CODES } from "@bseva/config";
import { Linking, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

export default function ContactScreen() {
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
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <ScreenHeader title={t("mobile.contact")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        {config.isLoading ? <LoadingBlock /> : null}
        <ErrorBanner message={error} />
        <Card style={{ gap: 10 }}>
          {phone ? (
            <>
              <AppText variant="small">{t("nav.contact")}</AppText>
              <AppText variant="h3">{phone}</AppText>
              <PrimaryButton title={phone} onPress={() => void Linking.openURL(`tel:${digits}`)} />
              <PrimaryButton title={t("mobile.whatsapp")} variant="outline" onPress={() => void Linking.openURL(`https://wa.me/${digits.replace(/^\+/, "")}`)} />
            </>
          ) : null}
          {email ? (
            <>
              <AppText variant="small">{email}</AppText>
              <PrimaryButton title={email} variant="outline" onPress={() => void Linking.openURL(`mailto:${email}`)} />
            </>
          ) : null}
        </Card>
        <Card style={{ gap: 10 }}>
          <AppText variant="h3">{t("contact.sendMessage")}</AppText>
          {sent ? <AppText>{t("contact.sent")}</AppText> : null}
          <Field label={t("auth.name")} value={name} onChangeText={setName} />
          <Field label={t("auth.email")} value={mail} onChangeText={setMail} autoCapitalize="none" keyboardType="email-address" />
          <ChoiceChips options={PHONE_COUNTRY_CODES.map((c: { code: string }) => ({ id: c.code, label: c.code }))} value={countryCode} onChange={(v) => setCountryCode(String(v))} />
          <Field label={t("auth.phone")} value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />
          <Field label={t("contact.subject")} value={subject} onChangeText={setSubject} />
          <Field label={t("contact.message")} value={message} onChangeText={setMessage} multiline />
          <PrimaryButton
            title={busy ? t("mobile.submitting") : t("contact.send")}
            loading={busy}
            onPress={async () => {
              setError(null);
              const parsed = contactSchema.safeParse({
                name,
                email: mail,
                country_code: countryCode,
                phone: mobile.replace(/\D/g, "").slice(-10),
                subject,
                message,
              });
              if (!parsed.success) {
                setError(t(parsed.error.issues[0]?.message || "mobile.checkForm"));
                return;
              }
              setBusy(true);
              try {
                await apiClient.contactMessage(parsed.data);
                setSent(true);
                setMessage("");
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : t("mobile.failed"));
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
