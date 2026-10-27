import { Ionicons } from "@expo/vector-icons";
import { bankDraftTouched, hasSettlementMethod, settlementPayload, validateSettlement } from "@bseva/validation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { showSuccessAlert } from "@/utils/actionFeedback";

type BankDraft = {
  upiId: string;
  holder: string;
  bankName: string;
  ifsc: string;
  accountNumber: string;
  accountConfirm: string;
};

const EMPTY: BankDraft = { upiId: "", holder: "", bankName: "", ifsc: "", accountNumber: "", accountConfirm: "" };

/** Same fields, wording and lock/edit flow as the web Bank / UPI page (BankPage.tsx). */
export default function BankScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const q = useQuery({ queryKey: ["pujari-profile"], queryFn: () => apiClient.getPujariProfile() });
  const [baseline, setBaseline] = useState<BankDraft>(EMPTY);
  const [draft, setDraft] = useState<BankDraft>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    const acct = String(q.data.bank_account_number || "");
    const saved: BankDraft = {
      upiId: String(q.data.upi_id || ""),
      holder: String(q.data.bank_holder_name || ""),
      bankName: String(q.data.bank_name || ""),
      ifsc: String(q.data.bank_ifsc || ""),
      accountNumber: acct,
      accountConfirm: acct,
    };
    setBaseline(saved);
    setDraft(saved);
    // Nothing saved yet: open straight in edit mode, like the web.
    setEditing(!hasSettlementMethod(saved));
  }, [q.data]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(baseline), [draft, baseline]);
  const bankRequired = bankDraftTouched(draft);

  function setField<K extends keyof BankDraft>(key: K, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function cancelEdit() {
    setDraft(baseline);
    setFieldErrors({});
    setError(null);
    setEditing(false);
  }

  async function save() {
    setError(null);
    setFieldErrors({});
    const errs = validateSettlement(draft);
    if (Object.keys(errs).length) {
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(errs)) next[key] = t(String(value));
      setFieldErrors(next);
      if (next.settlement) setError(next.settlement);
      return;
    }
    if (!hasSettlementMethod(draft)) {
      setError(t("web.validation.settlement"));
      return;
    }
    setBusy(true);
    try {
      await apiClient.patchPujariProfile(settlementPayload(draft));
      await q.refetch();
      setEditing(false);
      showSuccessAlert(t("web.bank.saved"));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("web.bank.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("mobile.bank")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <AppText variant="small" color={colors.mutedForeground}>
          {t("web.bank.description")}
        </AppText>
        <ErrorBanner message={error} />

        {!editing ? (
          <Card style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, borderColor: `${colors.primary}66`, backgroundColor: `${colors.primary}0D` }}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.primary} style={{ marginTop: 2 }} />
            <AppText variant="small" style={{ flex: 1, fontWeight: "600" }}>
              {t("web.bank.lockedHint")}
            </AppText>
          </Card>
        ) : null}

        <Field
          label={t("web.bank.upi")}
          value={draft.upiId}
          onChangeText={(v) => setField("upiId", v.trim().toLowerCase())}
          placeholder="yourname@oksbi"
          autoCapitalize="none"
          autoCorrect={false}
          editable={editing}
          error={fieldErrors.upiId}
        />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <AppText variant="small" color={colors.mutedForeground} style={{ textTransform: "uppercase", fontSize: 11 }}>
            {t("web.bank.orAccount")}
          </AppText>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        <Field
          label={t("web.bank.holder")}
          required={bankRequired}
          value={draft.holder}
          onChangeText={(v) => setField("holder", v)}
          editable={editing}
          error={fieldErrors.holder}
        />
        <Field
          label={t("web.bank.name")}
          required={bankRequired}
          value={draft.bankName}
          onChangeText={(v) => setField("bankName", v)}
          placeholder={t("web.bank.namePlaceholder")}
          editable={editing}
          error={fieldErrors.bankName}
        />
        <Field
          label="IFSC"
          required={bankRequired}
          value={draft.ifsc}
          onChangeText={(v) => setField("ifsc", v.toUpperCase())}
          autoCapitalize="characters"
          maxLength={11}
          editable={editing}
          error={fieldErrors.ifsc}
        />
        <Field
          label={t("web.bank.account")}
          required={bankRequired}
          value={draft.accountNumber}
          onChangeText={(v) => setField("accountNumber", v.replace(/\D/g, "").slice(0, 18))}
          keyboardType="number-pad"
          editable={editing}
          error={fieldErrors.accountNumber}
        />
        <Field
          label={t("web.bank.confirmAccount")}
          required={bankRequired}
          value={draft.accountConfirm}
          onChangeText={(v) => setField("accountConfirm", v.replace(/\D/g, "").slice(0, 18))}
          keyboardType="number-pad"
          editable={editing}
          error={fieldErrors.accountConfirm}
        />

        {!editing ? (
          <PrimaryButton title={t("common.edit")} onPress={() => setEditing(true)} />
        ) : (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {hasSettlementMethod(baseline) ? (
              <View style={{ flex: 1 }}>
                <PrimaryButton title={t("common.cancel")} variant="outline" disabled={busy} onPress={cancelEdit} />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title={busy ? t("web.common.saving") : t("common.save")}
                loading={busy}
                disabled={busy || !dirty}
                onPress={() => void save()}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
