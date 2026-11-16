import { rupees } from "@bseva/config";
import { formatDisplayDate } from "@bseva/locales";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { AdminFormModal } from "@/components/admin/AdminFormModal";
import { apiErr, CHALLENGE_RESET_CODES, PayoutModal } from "@/components/admin/payments/PayoutModal";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  AppText,
  Card,
  ChoiceChips,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  PrimaryButton,
  Screen,
  StatusBadge,
  SuccessBanner,
} from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type Row = {
  id: string;
  booking_id?: string;
  booking_number?: string;
  pujari_name?: string;
  customer_name?: string;
  status?: string;
  due_date?: string;
  amount_paise?: number;
  settlement_amount_paise?: number;
  pujari_payable_paise?: number;
  customer_payment_paise?: number;
  platform_fee_paise?: number;
  blocked_paise?: number;
  blocked_reason?: string | null;
  override_flag?: boolean;
  payment_reference?: string | null;
  processed_by_name?: string | null;
  approved_by_name?: string | null;
};

type ListRes = { items?: Row[]; hold_days?: number } | Row[];

const STATUS_OPTIONS = [
  { id: "", label: "All Statuses" },
  { id: "awaiting", label: "Awaiting Cycle" },
  { id: "pending", label: "Pending" },
  { id: "eligible", label: "Eligible" },
  { id: "settled", label: "Settled" },
  { id: "blocked", label: "Blocked" },
];

function settledBy(s: Row, name?: string | null) {
  if (name) return name;
  if (s.status === "settled" && s.payment_reference?.startsWith("AUTO_")) return "System (automatic)";
  return "—";
}

function amountOf(s: Row) {
  return s.settlement_amount_paise ?? s.pujari_payable_paise ?? s.amount_paise;
}

export default function AdminSettlements() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { can } = useAdmin();
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";
  const params = useLocalSearchParams<{ status?: string }>();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Override dialog
  const [active, setActive] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [mpin, setMpin] = useState("");
  const [otp, setOtp] = useState("");
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogInfo, setDialogInfo] = useState<string | null>(null);

  // Payout dialog
  const [payoutFor, setPayoutFor] = useState<Row | null>(null);

  useEffect(() => {
    const next = typeof params.status === "string" ? params.status : "";
    if (next) setStatus(next);
  }, [params.status]);

  const list = useQuery({
    queryKey: ["settlements", q, status],
    queryFn: () =>
      apiClient.api<ListRes>(
        `/settlements?page=1&limit=50${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}`
      ),
  });
  // Web reads pujari_settlement_days from /admin/config for the payout cycle text.
  const config = useQuery({
    queryKey: ["admin-config"],
    queryFn: () => apiClient.api<Record<string, unknown>>("/admin/config"),
    enabled: can("manage_config"),
    retry: false,
  });
  const rows = Array.isArray(list.data) ? list.data : list.data?.items || [];
  const cfgDays = Number(config.data?.pujari_settlement_days);
  const listDays = Array.isArray(list.data) ? NaN : Number(list.data?.hold_days);
  const holdDays = Number.isFinite(cfgDays) && cfgDays > 0 ? cfgDays : Number.isFinite(listDays) && listDays > 0 ? listDays : 3;

  function closeDialog() {
    setActive(null);
    setReason("");
    setPaymentRef("");
    setChallengeId(null);
    setMpin("");
    setOtp("");
    setDialogError(null);
    setDialogInfo(null);
  }

  async function requestOtp() {
    if (!active || saving) return;
    if (reason.trim().length < 3) {
      setDialogError("Reason required");
      return;
    }
    setSaving(true);
    setDialogError(null);
    try {
      const out = await apiClient.api<{ challenge_id: string; email?: string; expires_in_minutes: number }>("/admin/security/challenge", {
        method: "POST",
        body: JSON.stringify({
          action: "settlement_override",
          settlement_id: active.id,
          payment_reference: paymentRef.trim() || null,
        }),
      });
      setChallengeId(out.challenge_id);
      setOtp("");
      setDialogInfo(`OTP sent to ${out.email || "your email"}. Valid for ${out.expires_in_minutes} minutes.`);
    } catch (e: unknown) {
      setDialogError(apiErr(e).message);
    } finally {
      setSaving(false);
    }
  }

  async function settle() {
    if (!active || !challengeId || saving) return;
    setSaving(true);
    setDialogError(null);
    try {
      await apiClient.api(`/settlements/${active.id}/override`, {
        method: "POST",
        body: JSON.stringify({
          reason: reason.trim(),
          mark_settled: true,
          payment_reference: paymentRef.trim() || null,
          challenge_id: challengeId,
          otp,
          mpin,
        }),
      });
      // Reached only after the server has credited the wallet and committed.
      setSuccess("Settlement paid and recorded");
      setError(null);
      closeDialog();
      await list.refetch();
    } catch (e: unknown) {
      const { message, code } = apiErr(e);
      setDialogError(message);
      setMpin("");
      setOtp("");
      if (code && CHALLENGE_RESET_CODES.includes(code)) {
        setChallengeId(null);
        setDialogInfo(null);
      }
    } finally {
      setSaving(false);
    }
  }

  const muted = (text: string) => (
    <AppText variant="small" color={colors.mutedForeground}>
      {text}
    </AppText>
  );

  return (
    <Screen>
      <ScreenHeader title={t("admin.settlements")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {muted(
          `Pujaris are paid automatically every ${holdDays} days, counted from each pujari's joining date. Use Settle / Override only for early payout or special cases.`
        )}
        <ErrorBanner message={error || (list.error ? apiErr(list.error).message : null)} />
        <SuccessBanner message={success} />
        <Field label={t("admin.search")} value={q} onChangeText={setQ} />
        <ChoiceChips horizontal options={STATUS_OPTIONS} value={status} onChange={(v) => setStatus(String(v))} />
        {list.isLoading ? <LoadingBlock /> : null}
        {!list.isLoading && !list.error && rows.length === 0 ? <EmptyState title="No settlements match these filters." /> : null}
        {rows.map((s) => {
          const tags = [
            s.status === "settled" && s.payment_reference?.startsWith("AUTO_") ? "auto" : null,
            s.status === "settled" && s.override_flag ? "override" : null,
            s.status === "blocked" && s.blocked_reason === "pujari_no_show" ? "no-show" : null,
          ].filter(Boolean);
          const open = ["pending", "eligible"].includes(String(s.status));
          return (
            <Card key={s.id}>
              <StatusBadge status={String(s.status || "pending")} />
              {tags.length ? muted(tags.join(" · ")) : null}
              <AppText variant="h3">{s.pujari_name || s.id}</AppText>
              <AppText>{rupees(amountOf(s))}</AppText>
              {muted(`Booking ${s.booking_number || String(s.booking_id || "").slice(0, 8)} · ${s.customer_name || "—"}`)}
              {s.due_date ? muted(`Due: ${formatDisplayDate(s.due_date)}`) : null}
              {s.customer_payment_paise != null ? muted(`Customer paid: ${rupees(s.customer_payment_paise)}`) : null}
              {s.platform_fee_paise != null ? muted(`Platform fee: ${rupees(s.platform_fee_paise)}`) : null}
              {Number(s.blocked_paise || 0) ? muted(`Blocked: ${rupees(s.blocked_paise)}`) : null}
              <AppText>Processed by: {settledBy(s, s.processed_by_name)}</AppText>
              <AppText>Approved by: {settledBy(s, s.approved_by_name)}</AppText>
              {open ? (
                <View style={{ gap: 8, marginTop: 8 }}>
                  <PrimaryButton
                    title="Settle / Override"
                    variant="outline"
                    onPress={() => {
                      closeDialog();
                      setActive(s);
                    }}
                  />
                  {isSuper ? (
                    <PrimaryButton
                      title="Pay to bank"
                      variant="outline"
                      onPress={() => {
                        setSuccess(null);
                        setPayoutFor(s);
                      }}
                    />
                  ) : null}
                </View>
              ) : null}
              {s.status === "processing" ? muted("Bank payout in progress") : null}
            </Card>
          );
        })}
      </ScrollView>

      <AdminFormModal
        visible={!!active}
        title="Override — Settle Early"
        onClose={closeDialog}
        submitLabel={challengeId ? (saving ? "Verifying…" : "Confirm Payment") : saving ? "Sending…" : "Send OTP"}
        onSubmit={() => void (challengeId ? settle() : requestOtp())}
        loading={saving}
        disabled={challengeId ? mpin.length !== 6 || otp.length !== 6 : false}
      >
        <ErrorBanner message={dialogError} />
        <SuccessBanner message={dialogInfo} />
        {muted(
          `Normally this settles automatically on the due date (${formatDisplayDate(active?.due_date)}). Override credits the pujari wallet now with ${rupees(
            active ? amountOf(active) : 0
          )}.`
        )}
        <Field label="Reason" value={reason} onChangeText={setReason} multiline editable={!challengeId} />
        <Field label="Payment Reference (Optional)" value={paymentRef} onChangeText={setPaymentRef} editable={!challengeId} />
        {challengeId ? (
          <>
            <Field
              label="MPIN"
              value={mpin}
              onChangeText={(v) => setMpin(v.replace(/\D/g, "").slice(0, 6))}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="off"
            />
            <Field
              label="Email OTP"
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
            />
            <PrimaryButton title="Resend OTP" variant="outline" onPress={() => void requestOtp()} disabled={saving} />
          </>
        ) : null}
        <PrimaryButton title="Cancel" variant="ghost" onPress={closeDialog} disabled={saving} />
      </AdminFormModal>

      <PayoutModal
        settlement={payoutFor ? { id: payoutFor.id, settlement_amount_paise: amountOf(payoutFor), pujari_name: payoutFor.pujari_name } : null}
        onClose={() => setPayoutFor(null)}
        onDone={(message, failed) => {
          if (failed) {
            setError(message);
            setSuccess(null);
          } else {
            setSuccess(message);
            setError(null);
          }
          void list.refetch();
        }}
      />
    </Screen>
  );
}
