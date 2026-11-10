import {
  ApiError,
  DELETION_REASON_KEYS,
  type DeletionObligationBooking,
  type DeletionOverview,
  type DeletionReasonKey,
} from "@bseva/api-client";
import { isPujariRole, rupees } from "@bseva/config";
import { formatDisplayDate } from "@bseva/locales";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, Switch, View } from "react-native";
import { isSixDigitCode, OtpCodeField } from "@/components/OtpCodeField";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SelectField } from "@/components/SelectField";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import {
  DELETION_REASON_LABELS,
  EXPLANATION_MAX,
  EXPLANATION_MIN,
  OTP_RESEND_SECONDS,
  text,
} from "@/content/compliance";
import { useCountdown } from "@/hooks/useCountdown";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { apiErrorMessage } from "@/utils/userMessage";

type Step = "form" | "code" | "done";

const OPEN_STATES = new Set(["requested", "pending_resolution", "ready", "escalated"]);

function slotLabel(b: DeletionObligationBooking) {
  const time = (b.start_time || "").slice(0, 5);
  return `${formatDisplayDate(b.booking_date)}${time ? ` · ${time}` : ""}`;
}

function BookingRow({ b, pujari }: { b: DeletionObligationBooking; pujari: boolean }) {
  const { colors } = useAppTheme();
  const c = b.cancellation;
  return (
    <View style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.muted, gap: 2 }}>
      <AppText style={{ fontWeight: "700" }}>{b.service_name}</AppText>
      <AppText variant="small" color={colors.mutedForeground}>
        #{b.booking_number} · {slotLabel(b)}
      </AppText>
      {!pujari && b.kind === "upcoming" && c ? (
        c.allowed ? (
          <AppText variant="small">
            {text.refund}: {rupees(c.refund_paise)} · {text.fee}: {rupees(c.fee_paise)}
          </AppText>
        ) : (
          <AppText variant="small" color={colors.destructive}>
            {text.cancellationNotAllowed}
          </AppText>
        )
      ) : null}
      {!pujari && c?.policy_note ? (
        <AppText variant="small" color={colors.mutedForeground}>
          {c.policy_note}
        </AppText>
      ) : null}
      {pujari && b.action === "reassign" ? (
        <AppText variant="small" color={colors.mutedForeground}>
          {text.reassign}
        </AppText>
      ) : null}
    </View>
  );
}

function Obligations({ overview, pujari }: { overview: DeletionOverview; pujari: boolean }) {
  const { colors } = useAppTheme();
  const o = overview.obligations;
  const upcoming = o.bookings.filter((b) => b.kind === "upcoming");
  const ongoing = o.bookings.filter((b) => b.kind === "ongoing");
  const unpaid = o.bookings.filter((b) => b.kind === "unpaid");
  const nothing =
    !o.bookings.length && !o.wallet_balance_paise && !o.pending_refunds && !o.pending_settlement_paise && !o.blocking.length;
  return (
    <Card style={{ gap: 10 }}>
      <AppText variant="h3">{text.obligationsTitle}</AppText>
      {nothing ? <AppText color={colors.mutedForeground}>{text.noObligations}</AppText> : null}
      {unpaid.length ? (
        <View style={{ gap: 4 }}>
          <AppText style={{ fontWeight: "700" }}>
            {text.unpaidBookings} ({unpaid.length})
          </AppText>
          <AppText variant="small" color={colors.mutedForeground}>
            {text.unpaidNote}
          </AppText>
          {unpaid.map((b) => (
            <BookingRow key={b.id} b={b} pujari={pujari} />
          ))}
        </View>
      ) : null}
      {upcoming.length ? (
        <View style={{ gap: 4 }}>
          <AppText style={{ fontWeight: "700" }}>
            {text.upcomingBookings} ({upcoming.length})
          </AppText>
          <AppText variant="small" color={colors.mutedForeground}>
            {pujari ? text.upcomingPujariNote : text.upcomingCustomerNote}
          </AppText>
          {upcoming.map((b) => (
            <BookingRow key={b.id} b={b} pujari={pujari} />
          ))}
        </View>
      ) : null}
      {ongoing.length ? (
        <View style={{ gap: 4 }}>
          <AppText style={{ fontWeight: "700" }}>
            {text.ongoingBookings} ({ongoing.length})
          </AppText>
          <AppText variant="small" color={colors.mutedForeground}>
            {text.ongoingNote}
          </AppText>
          {ongoing.map((b) => (
            <BookingRow key={b.id} b={b} pujari={pujari} />
          ))}
        </View>
      ) : null}
      {o.wallet_balance_paise ? (
        <AppText>
          {text.walletBalance}: {rupees(o.wallet_balance_paise)}
        </AppText>
      ) : null}
      {o.pending_refunds ? (
        <AppText>
          {text.pendingRefunds}: {o.pending_refunds}
        </AppText>
      ) : null}
      {o.pending_settlement_paise ? (
        <AppText>
          {text.pendingSettlement}: {rupees(o.pending_settlement_paise)}
        </AppText>
      ) : null}
      {o.blocking.length ? (
        <View style={{ gap: 4, padding: 10, borderRadius: 10, backgroundColor: colors.destructive + "14" }}>
          <AppText style={{ fontWeight: "700" }} color={colors.destructive}>
            {text.blockingTitle}
          </AppText>
          {o.blocking.map((m, i) => (
            <AppText key={`${i}-${m}`} variant="small">
              • {m}
            </AppText>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const q = useQuery({ queryKey: ["account-deletion"], queryFn: () => apiClient.deletionOverview(), retry: false });
  const overview = q.data;
  const pujari = overview ? overview.account.role !== "customer" : isPujariRole(user?.role);

  const [step, setStep] = useState<Step>("form");
  const [reason, setReason] = useState<DeletionReasonKey | "">("");
  const [explanation, setExplanation] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [code, setCode] = useState("");
  const [emailHint, setEmailHint] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resend = useCountdown();

  const finish = useCallback(async () => {
    await logout();
    router.replace("/");
  }, [logout, router]);

  // Once deactivated the session is dead on the server; leaving this screen always signs out.
  useEffect(() => {
    if (step !== "done") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      void finish();
      return true;
    });
    return () => sub.remove();
  }, [step, finish]);

  const reasonOptions = DELETION_REASON_KEYS.map((key) => ({ id: key, label: DELETION_REASON_LABELS[key] }));
  const trimmed = explanation.trim();

  async function requestOtp(): Promise<boolean> {
    setError(null);
    if (!reason) {
      setError(text.reasonRequired);
      return false;
    }
    if (trimmed.length < EXPLANATION_MIN) {
      setError(text.explanationTooShort);
      return false;
    }
    if (!understood) {
      setError(text.confirmRequired);
      return false;
    }
    setBusy(true);
    try {
      const out = await apiClient.requestDeletionOtp({ reason, explanation: trimmed });
      setEmailHint(out?.email_hint);
      resend.start(OTP_RESEND_SECONDS);
      return true;
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 429) resend.start(OTP_RESEND_SECONDS);
      setError(apiErrorMessage(t, e, "mobile.failed"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setError(null);
    if (!reason) return;
    if (!isSixDigitCode(code)) return setError(text.enterCode);
    setBusy(true);
    try {
      await apiClient.confirmDeletion({ reason, explanation: trimmed, code: code.trim() });
      setStep("done");
    } catch (e: unknown) {
      if (e instanceof ApiError && e.code === "INVALID_CODE") setError(text.invalidCode);
      else setError(apiErrorMessage(t, e, "mobile.failed"));
    } finally {
      setBusy(false);
    }
  }

  const openRequest = overview?.request && OPEN_STATES.has(overview.request.state) ? overview.request : null;

  return (
    <Screen>
      <ScreenHeader title={text.deleteTitle} back={step !== "done"} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          {step === "done" ? (
            <Card style={{ gap: 14 }}>
              <AppText style={{ lineHeight: 22 }}>{text.deactivationMessage}</AppText>
              <PrimaryButton title={text.done} onPress={() => void finish()} />
            </Card>
          ) : q.isLoading ? (
            <LoadingBlock />
          ) : q.error || !overview ? (
            <>
              <ErrorBanner message={apiErrorMessage(t, q.error, "mobile.failed")} />
              <PrimaryButton title={t("mobile.retry")} variant="outline" onPress={() => void q.refetch()} />
            </>
          ) : openRequest ? (
            <Card style={{ gap: 8 }}>
              <AppText variant="h3">{text.existingRequest}</AppText>
              <AppText style={{ lineHeight: 22 }}>{openRequest.message}</AppText>
            </Card>
          ) : (
            <>
              <Card style={{ gap: 8, borderColor: colors.destructive }}>
                <AppText style={{ fontWeight: "700" }} color={colors.destructive}>
                  {text.deleteAccount}
                </AppText>
                <AppText style={{ lineHeight: 22 }}>{text.deleteWarning}</AppText>
                <AppText variant="small" color={colors.mutedForeground}>
                  {overview.account.email}
                </AppText>
              </Card>

              <Obligations overview={overview} pujari={pujari} />

              {overview.retention_notice ? (
                <Card style={{ gap: 6 }}>
                  <AppText variant="h3">{text.retentionTitle}</AppText>
                  <AppText variant="small" style={{ lineHeight: 20 }}>
                    {overview.retention_notice}
                  </AppText>
                </Card>
              ) : null}

              {step === "form" ? (
                <Card style={{ gap: 12 }}>
                  <ErrorBanner message={error} />
                  <SelectField
                    label={text.reason}
                    value={reason}
                    options={reasonOptions}
                    placeholder={text.chooseReason}
                    onChange={(id) => setReason(id as DeletionReasonKey)}
                  />
                  <View style={{ gap: 4 }}>
                    <Field
                      label={text.explanation}
                      value={explanation}
                      onChangeText={(v) => setExplanation(v.slice(0, EXPLANATION_MAX))}
                      multiline
                      maxLength={EXPLANATION_MAX}
                      required
                    />
                    <AppText
                      variant="small"
                      color={trimmed.length > 0 && trimmed.length < EXPLANATION_MIN ? colors.destructive : colors.mutedForeground}
                      style={{ textAlign: "right" }}
                    >
                      {explanation.length}/{EXPLANATION_MAX} · {text.explanationHint}
                    </AppText>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                    <Switch
                      value={understood}
                      onValueChange={setUnderstood}
                      trackColor={{ true: colors.destructive }}
                      accessibilityRole="switch"
                      accessibilityLabel={text.confirmToggle}
                      accessibilityState={{ checked: understood }}
                    />
                    <AppText variant="small" style={{ flex: 1, paddingTop: 2, lineHeight: 20 }}>
                      {text.confirmToggle}
                    </AppText>
                  </View>
                  <PrimaryButton
                    title={busy ? text.sending : text.continue}
                    loading={busy}
                    disabled={!reason || trimmed.length < EXPLANATION_MIN || !understood}
                    onPress={async () => {
                      if (await requestOtp()) setStep("code");
                    }}
                  />
                </Card>
              ) : null}

              {step === "code" ? (
                <Card style={{ gap: 12 }}>
                  <AppText style={{ lineHeight: 22 }}>{text.codeSentTo(emailHint)}</AppText>
                  <ErrorBanner message={error} />
                  <OtpCodeField
                    value={code}
                    onChange={setCode}
                    resendLeft={resend.left}
                    resending={busy}
                    onResend={() => void requestOtp()}
                  />
                  <PrimaryButton title={busy ? text.deleting : text.confirmDelete} loading={busy} onPress={confirm} />
                  <PrimaryButton
                    title={t("common.back")}
                    variant="ghost"
                    disabled={busy}
                    onPress={() => {
                      setStep("form");
                      setCode("");
                      setError(null);
                    }}
                  />
                </Card>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
