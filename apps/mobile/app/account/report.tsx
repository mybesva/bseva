import { REPORT_REASON_KEYS, type ReportReasonKey, type ReportTargetType } from "@bseva/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SelectField } from "@/components/SelectField";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import {
  REPORT_DETAILS_MAX,
  REPORT_DETAILS_MIN,
  REPORT_REASON_LABELS,
  text,
} from "@/content/compliance";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { showSuccessAlert } from "@/utils/actionFeedback";
import { apiErrorMessage } from "@/utils/userMessage";

const TARGETS: ReportTargetType[] = ["booking", "pujari", "customer"];

/**
 * Report a booking, or the other party on it.
 * Params: booking_id (required), pujari_id / customer_id (the other party, when known), target (preselect).
 */
export default function ReportScreen() {
  const params = useLocalSearchParams<{ booking_id?: string; pujari_id?: string; customer_id?: string; target?: string; label?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const bookingId = typeof params.booking_id === "string" ? params.booking_id : "";
  const partyIds: Record<ReportTargetType, string> = {
    booking: bookingId,
    pujari: typeof params.pujari_id === "string" ? params.pujari_id : "",
    customer: typeof params.customer_id === "string" ? params.customer_id : "",
  };
  const available = TARGETS.filter((tt) => Boolean(partyIds[tt]));
  const initial = available.includes(params.target as ReportTargetType) ? (params.target as ReportTargetType) : available[0] || "booking";
  const [target, setTarget] = useState<ReportTargetType>(initial);
  const [reason, setReason] = useState<ReportReasonKey | "">("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trimmed = details.trim();

  const targetLabel: Record<ReportTargetType, string> = {
    booking: text.reportBooking,
    pujari: text.reportPujari,
    customer: text.reportCustomer,
  };

  async function submit() {
    setError(null);
    if (!reason) return setError(text.reasonRequired);
    if (trimmed.length < REPORT_DETAILS_MIN) return setError(text.detailsTooShort);
    const targetId = partyIds[target];
    if (!targetId) return setError(text.somethingWrong);
    setBusy(true);
    try {
      await apiClient.createReport({
        target_type: target,
        target_id: targetId,
        booking_id: bookingId || undefined,
        reason,
        details: trimmed,
      });
      void qc.invalidateQueries({ queryKey: ["my-reports"] });
      showSuccessAlert(text.reportSent, undefined, [{ text: text.done, onPress: () => router.back() }]);
    } catch (e: unknown) {
      setError(apiErrorMessage(t, e, "mobile.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={text.reportTitle} back />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 12 }}>
            <AppText color={colors.mutedForeground} style={{ lineHeight: 22 }}>
              {text.reportIntro}
            </AppText>
            {typeof params.label === "string" && params.label ? (
              <AppText style={{ fontWeight: "700" }}>{params.label}</AppText>
            ) : null}
            <ErrorBanner message={error} />
            {available.length > 1 ? (
              <ChoiceChips
                options={available.map((id) => ({ id, label: targetLabel[id] }))}
                value={target}
                onChange={(v) => setTarget(v as ReportTargetType)}
              />
            ) : null}
            <SelectField
              label={text.reason}
              value={reason}
              options={REPORT_REASON_KEYS.map((key) => ({ id: key, label: REPORT_REASON_LABELS[key] }))}
              placeholder={text.chooseReason}
              onChange={(id) => setReason(id as ReportReasonKey)}
            />
            <View style={{ gap: 4 }}>
              <Field
                label={text.details}
                value={details}
                onChangeText={(v) => setDetails(v.slice(0, REPORT_DETAILS_MAX))}
                multiline
                maxLength={REPORT_DETAILS_MAX}
                required
              />
              <AppText
                variant="small"
                color={trimmed.length > 0 && trimmed.length < REPORT_DETAILS_MIN ? colors.destructive : colors.mutedForeground}
                style={{ textAlign: "right" }}
              >
                {details.length}/{REPORT_DETAILS_MAX} · {text.detailsHint}
              </AppText>
            </View>
            <PrimaryButton
              title={busy ? text.submitting : text.submitReport}
              loading={busy}
              disabled={!bookingId || !reason || trimmed.length < REPORT_DETAILS_MIN}
              onPress={submit}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
