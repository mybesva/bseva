import { hasSettlementMethod, settlementPayload, validateSettlement } from "@bseva/validation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";

export default function BankScreen() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["pujari-profile"], queryFn: () => apiClient.getPujariProfile() });
  const [upiId, setUpiId] = useState("");
  const [holder, setHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountConfirm, setAccountConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!q.data) return;
    const acct = String(q.data.bank_account_number || "");
    setUpiId(String(q.data.upi_id || ""));
    setHolder(String(q.data.bank_holder_name || ""));
    setBankName(String(q.data.bank_name || ""));
    setIfsc(String(q.data.bank_ifsc || ""));
    setAccountNumber(acct);
    setAccountConfirm(acct);
  }, [q.data]);
  const draft = { upiId, holder, bankName, ifsc, accountNumber, accountConfirm };
  return (
    <Screen>
      <ScreenHeader title={t("mobile.bank")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        <ErrorBanner message={error} />
        <AppText variant="small">{t("mobile.bankHelp")}</AppText>
        <Field label={t("web.bank.upi")} value={upiId} onChangeText={setUpiId} autoCapitalize="none" error={fieldErrors.upiId} />
        <Field label={t("web.bank.holder")} value={holder} onChangeText={setHolder} error={fieldErrors.holder} />
        <Field label={t("web.bank.name")} value={bankName} onChangeText={setBankName} error={fieldErrors.bankName} />
        <Field label={t("mobile.ifsc")} value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" error={fieldErrors.ifsc} />
        <Field label={t("web.bank.account")} value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" error={fieldErrors.accountNumber} />
        <Field
          label={t("web.bank.confirmAccount")}
          value={accountConfirm}
          onChangeText={setAccountConfirm}
          keyboardType="number-pad"
          error={fieldErrors.accountConfirm}
        />
        <PrimaryButton
          title={t("mobile.save")}
          onPress={async () => {
            setError(null);
            setFieldErrors({});
            const errs = validateSettlement(draft);
            if (Object.keys(errs).length) {
              const next: Record<string, string> = {};
              for (const [key, value] of Object.entries(errs)) {
                next[key] = t(String(value));
              }
              setFieldErrors(next);
              return;
            }
            if (!hasSettlementMethod(draft)) {
              setError(t("web.validation.settlement"));
              return;
            }
            try {
              await apiClient.patchPujariProfile(settlementPayload(draft));
              await q.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : t("mobile.failed"));
            }
          }}
        />
      </ScrollView>
    </Screen>
  );
}
