import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { AdminFormModal } from "@/components/admin/AdminFormModal";
import { AppText, ErrorBanner, Field, LoadingBlock, PrimaryButton, SuccessBanner } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type Preview = {
  amount_paise: number;
  destination: string;
  instrument: "bank" | "upi";
  mode: "wallet" | "bank";
  configured: boolean;
  environment: string;
  gross_paise: number;
  penalty_recovered_paise: number;
  net_paise: number;
};

export type PayoutSettlement = { id: string; settlement_amount_paise?: number; pujari_name?: string };

// Cashfree's answer, never our own request, decides what is shown: "paid" only on a reported SUCCESS.
const RESULT: Record<string, string> = {
  successful: "Cashfree confirmed the transfer. Settlement marked paid.",
  settled_to_penalty: "The whole settlement went to the penalty the pujari owed. No bank transfer was needed.",
  pending: "Transfer accepted by Cashfree and waiting for the bank. It is not paid yet; the status updates automatically.",
  initiated: "Transfer sent; Cashfree has not confirmed it yet. The status updates automatically.",
  failed: "Cashfree reported the transfer failed. Nothing was paid; the settlement is eligible again.",
};

export const CHALLENGE_RESET_CODES = ["VERIFICATION_EXPIRED", "VERIFICATION_MISMATCH", "OTP_ATTEMPTS_EXCEEDED", "MPIN_LOCKED"];

export function apiErr(e: unknown): { message: string; code?: string } {
  const message = e instanceof Error ? e.message : "Failed";
  const code = (e as { code?: string } | null)?.code;
  if (code === "MPIN_NOT_SET") return { message: `${message} Set your MPIN first: More → Security.`, code };
  return { message, code };
}

/** Bank / UPI payout of one settlement via Cashfree Payouts — mirrors web PayoutDialog. */
export function PayoutModal({
  settlement,
  onClose,
  onDone,
}: {
  settlement: PayoutSettlement | null;
  onClose: () => void;
  onDone: (message: string, failed: boolean) => void;
}) {
  const { colors } = useAppTheme();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [mpin, setMpin] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setError(null);
    setInfo(null);
    setChallengeId(null);
    setMpin("");
    setOtp("");
  }, [settlement?.id]);

  const preview = useQuery({
    queryKey: ["payout-preview", settlement?.id],
    queryFn: () => apiClient.api<Preview>(`/admin/payouts/settlements/${settlement!.id}/preview`),
    enabled: !!settlement,
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const p = preview.data;
  const ready = !!p && p.mode === "bank" && p.configured;

  async function requestOtp() {
    if (!settlement || busy) return;
    setBusy(true);
    setError(null);
    try {
      const out = await apiClient.api<{ challenge_id: string; email?: string; expires_in_minutes: number }>("/admin/security/challenge", {
        method: "POST",
        body: JSON.stringify({ action: "settlement_payout", settlement_id: settlement.id }),
      });
      setChallengeId(out.challenge_id);
      setInfo(`OTP sent to ${out.email || "your email"}. Valid for ${out.expires_in_minutes} minutes.`);
    } catch (e: unknown) {
      setError(apiErr(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!settlement || !challengeId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const out = await apiClient.api<{ status: string }>(`/admin/payouts/settlements/${settlement.id}`, {
        method: "POST",
        body: JSON.stringify({ challenge_id: challengeId, otp, mpin }),
      });
      const text = RESULT[out.status] || `Payout status: ${out.status}`;
      onDone(text, out.status === "failed");
      onClose();
    } catch (e: unknown) {
      const { message, code } = apiErr(e);
      setError(message);
      setMpin("");
      setOtp("");
      if (code && CHALLENGE_RESET_CODES.includes(code)) {
        setChallengeId(null);
        setInfo(null);
      }
    } finally {
      setBusy(false);
    }
  }

  const row = (label: string, value: string, bold?: boolean) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
      <AppText variant="small" style={{ flex: 1, fontWeight: bold ? "700" : "500" }}>
        {label}
      </AppText>
      <AppText variant="small" style={{ fontWeight: bold ? "700" : "500" }}>
        {value}
      </AppText>
    </View>
  );

  return (
    <AdminFormModal
      visible={!!settlement}
      title="Pay to bank / UPI"
      onClose={onClose}
      submitLabel={challengeId ? (busy ? "Sending…" : "Confirm payout") : busy ? "Sending…" : "Send OTP"}
      onSubmit={() => void (challengeId ? confirm() : requestOtp())}
      loading={busy}
      disabled={challengeId ? mpin.length !== 6 || otp.length !== 6 : !ready}
    >
      <ErrorBanner message={error || (preview.error ? apiErr(preview.error).message : null)} />
      <SuccessBanner message={info} />
      {preview.isLoading ? <LoadingBlock /> : null}
      {p ? (
        <>
          <AppText>
            Send <AppText style={{ fontWeight: "700" }}>{rupees(p.net_paise)}</AppText> to {settlement?.pujari_name || "the pujari"} at{" "}
            <AppText style={{ fontWeight: "700" }}>{p.destination}</AppText> through Cashfree Payouts ({p.environment}).
          </AppText>
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, gap: 6 }}>
            {row("Settlement", rupees(p.gross_paise))}
            {row("Penalty owed, kept back and credited to the wallet on success", `− ${rupees(p.penalty_recovered_paise)}`)}
            {row("Bank / UPI transfer", rupees(p.net_paise), true)}
          </View>
          {p.mode !== "bank" ? (
            <AppText variant="small" color={colors.mutedForeground}>
              Bank payouts are off: settlements are paid to the pujari wallet. Set Settlement payout mode to “bank” in Settings first.
            </AppText>
          ) : null}
          {!p.configured ? (
            <AppText variant="small" color={colors.mutedForeground}>
              Cashfree Payouts keys are not configured on this server.
            </AppText>
          ) : null}
          <AppText variant="small" color={colors.mutedForeground}>
            The OTP is tied to this settlement, amount and destination. If the pujari changes bank details, request a new OTP.
          </AppText>
        </>
      ) : null}
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
        </>
      ) : null}
      <PrimaryButton title="Cancel" variant="ghost" onPress={onClose} disabled={busy} />
    </AdminFormModal>
  );
}
