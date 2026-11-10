import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, rupees } from "@/lib/api";
import { adminPath } from "@/const";

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

// Cashfree's answer, never our own request, decides what is shown: "paid" only on a reported SUCCESS.
const RESULT: Record<string, string> = {
  successful: "Cashfree confirmed the transfer. Settlement marked paid.",
  settled_to_penalty: "The whole settlement went to the penalty the pujari owed. No bank transfer was needed.",
  pending: "Transfer accepted by Cashfree and waiting for the bank. It is not paid yet; the status updates automatically.",
  initiated: "Transfer sent; Cashfree has not confirmed it yet. The status updates automatically.",
  failed: "Cashfree reported the transfer failed. Nothing was paid; the settlement is eligible again.",
};

export default function PayoutDialog({
  settlement,
  onClose,
  onDone,
}: {
  settlement: { id: string; settlement_amount_paise: number; pujari_name?: string } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [, setLocation] = useLocation();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [mpin, setMpin] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPreview(null);
    setError(null);
    setChallengeId(null);
    setMpin("");
    setOtp("");
    if (!settlement) return;
    api<Preview>(`/admin/payouts/settlements/${settlement.id}/preview`)
      .then(setPreview)
      .catch((e: any) => setError(e.message));
  }, [settlement]);

  const ready = preview && preview.mode === "bank" && preview.configured;

  async function requestOtp() {
    if (!settlement) return;
    setBusy(true);
    try {
      const out = await api<{ challenge_id: string; email?: string; expires_in_minutes: number }>("/admin/security/challenge", {
        method: "POST",
        body: JSON.stringify({ action: "settlement_payout", settlement_id: settlement.id }),
      });
      setChallengeId(out.challenge_id);
      toast.success(`OTP sent to ${out.email || "your email"}. Valid for ${out.expires_in_minutes} minutes.`);
    } catch (e: any) {
      if (e.code === "MPIN_NOT_SET") setLocation(adminPath("/security"));
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!settlement || !challengeId) return;
    setBusy(true);
    try {
      const out = await api<{ status: string }>(`/admin/payouts/settlements/${settlement.id}`, {
        method: "POST",
        body: JSON.stringify({ challenge_id: challengeId, otp, mpin }),
      });
      const text = RESULT[out.status] || `Payout status: ${out.status}`;
      if (out.status === "failed") toast.error(text);
      else toast.success(text);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
      setMpin("");
      setOtp("");
      if (["VERIFICATION_EXPIRED", "VERIFICATION_MISMATCH", "OTP_ATTEMPTS_EXCEEDED", "MPIN_LOCKED"].includes(e.code)) {
        setChallengeId(null);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!settlement} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay to bank / UPI</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {error && <p className="text-destructive">{error}</p>}
          {preview && (
            <>
              <p>
                Send <strong>{rupees(preview.net_paise)}</strong> to {settlement?.pujari_name || "the pujari"} at{" "}
                <strong>{preview.destination}</strong> through Cashfree Payouts ({preview.environment}).
              </p>
              <div className="rounded-md border p-2 text-xs">
                <div className="flex justify-between"><span>Settlement</span><span>{rupees(preview.gross_paise)}</span></div>
                <div className="flex justify-between">
                  <span>Penalty owed, kept back and credited to the wallet on success</span>
                  <span>− {rupees(preview.penalty_recovered_paise)}</span>
                </div>
                <div className="flex justify-between font-semibold"><span>Bank / UPI transfer</span><span>{rupees(preview.net_paise)}</span></div>
              </div>
              {preview.mode !== "bank" && (
                <p className="text-muted-foreground">
                  Bank payouts are off: settlements are paid to the pujari wallet. Set Settlement payout mode to “bank” in Settings first.
                </p>
              )}
              {!preview.configured && <p className="text-muted-foreground">Cashfree Payouts keys are not configured on this server.</p>}
              <p className="text-xs text-muted-foreground">
                The OTP is tied to this settlement, amount and destination. If the pujari changes bank details, request a new OTP.
              </p>
            </>
          )}
          {challengeId && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="payout-mpin">MPIN</Label>
                <Input id="payout-mpin" type="password" value={mpin} inputMode="numeric" autoComplete="off"
                  onChange={(e) => setMpin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="payout-otp">Email OTP</Label>
                <Input id="payout-otp" value={otp} inputMode="numeric" autoComplete="one-time-code"
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {challengeId ? (
            <Button onClick={() => void confirm()} disabled={busy || mpin.length !== 6 || otp.length !== 6}>
              {busy ? "Sending…" : "Confirm payout"}
            </Button>
          ) : (
            <Button onClick={() => void requestOtp()} disabled={busy || !ready}>
              {busy ? "Sending…" : "Send OTP"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
