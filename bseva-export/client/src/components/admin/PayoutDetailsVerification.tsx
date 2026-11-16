import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

type Check = {
  id: string;
  instrument: "bank" | "upi";
  masked_details: string;
  status: "verified" | "name_mismatch" | "invalid" | "failed";
  name_at_bank: string | null;
  name_match_result: string | null;
  failure_reason: string | null;
  approved_at: string | null;
  approval_reason: string | null;
  created_at: string;
};

export type PayoutVerification = {
  has_details: boolean;
  message?: string;
  instrument?: "bank" | "upi";
  destination?: string;
  name_on_profile?: string;
  consent_at?: string | null;
  configured?: boolean;
  environment?: string;
  required: boolean;
  payable: boolean;
  current: Check | null;
};

const STATUS_TEXT: Record<Check["status"], string> = {
  verified: "Verified with the bank: the name matches.",
  name_mismatch: "The account is valid, but the bank's name does not match the pujari.",
  invalid: "The bank / UPI details are invalid. Ask the pujari to update them.",
  failed: "The check did not complete (bank or network). Try again.",
};

/**
 * Super Admin check of a pujari's payout bank account / UPI ID with Cashfree Secure ID. Payouts go only to verified
 * details (or a name mismatch a Super Admin approved after checking documents). Each check is billed by Cashfree and
 * a UPI check sends ₹1, so it runs only on request; details already verified are not checked again.
 */
export default function PayoutDetailsVerification({
  pujariId,
  onChange,
  compact = false,
}: {
  pujariId: string;
  onChange?: (v: PayoutVerification) => void;
  compact?: boolean;
}) {
  const [data, setData] = useState<PayoutVerification | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    try {
      const v = await api<PayoutVerification>(`/admin/pujaris/${pujariId}/payout-verification`);
      setData(v);
      onChange?.(v);
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [pujariId, onChange]);

  useEffect(() => {
    void load();
  }, [load]);

  async function verify() {
    setBusy(true);
    try {
      const out = await api<{ status: Check["status"]; reused: boolean }>(`/admin/pujaris/${pujariId}/payout-verification`, {
        method: "POST",
      });
      const msg = out.reused ? "These details were already verified." : STATUS_TEXT[out.status];
      if (out.status === "verified") toast.success(msg);
      else toast.error(msg);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!data?.current) return;
    setBusy(true);
    try {
      await api(`/admin/payout-verifications/${data.current.id}/approve`, { method: "POST", body: JSON.stringify({ reason }) });
      toast.success("Name mismatch approved. Payouts to these details are allowed.");
      setApproving(false);
      setReason("");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking payout details…
      </div>
    );
  }
  if (!data.has_details) return <p className="text-xs text-muted-foreground">{data.message || "No bank account or UPI ID yet."}</p>;

  const c = data.current;
  const approved = c?.status === "name_mismatch" && c.approved_at;
  const icon = data.payable ? (
    <ShieldCheck className="h-4 w-4 text-green-600" />
  ) : c?.status === "invalid" ? (
    <XCircle className="h-4 w-4 text-destructive" />
  ) : (
    <ShieldAlert className="h-4 w-4 text-amber-600" />
  );

  return (
    <div className="space-y-2 rounded-md border p-2 text-xs">
      <div className="flex items-start gap-2">
        {icon}
        <div className="space-y-0.5">
          <p className="font-medium">
            {data.payable
              ? approved
                ? "Approved for payouts (name mismatch accepted)"
                : "Bank / UPI details verified"
              : c
                ? STATUS_TEXT[c.status]
                : "Bank / UPI details not verified yet"}
          </p>
          {!compact && <p className="text-muted-foreground">{data.destination} · name on profile: {data.name_on_profile}</p>}
          {c?.name_at_bank && (
            <p className="text-muted-foreground">
              Name at bank: <strong>{c.name_at_bank}</strong>
              {c.name_match_result ? ` (${c.name_match_result.replace(/_/g, " ").toLowerCase()})` : ""}
            </p>
          )}
          {approved && <p className="text-muted-foreground">Approval reason: {c?.approval_reason}</p>}
          {c?.failure_reason && c.status !== "verified" && <p className="text-muted-foreground">Reason: {c.failure_reason}</p>}
          {data.instrument === "upi" && !data.consent_at && (
            <p className="text-amber-700">
              UPI checks send ₹1, so the pujari must save their Bank &amp; UPI details once in the app (which records their consent).
            </p>
          )}
          {!data.required && <p className="text-muted-foreground">Verification is not required right now (Settings).</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {!data.payable && data.configured !== false && (
          <Button size="sm" variant="outline" onClick={() => void verify()} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
            {c ? "Verify again" : "Verify with bank"}
          </Button>
        )}
        {data.configured === false && <span className="text-muted-foreground">Cashfree Secure ID keys are not configured on this server.</span>}
        {c?.status === "name_mismatch" && !c.approved_at && !approving && (
          <Button size="sm" variant="outline" onClick={() => setApproving(true)} disabled={busy}>
            Approve mismatch…
          </Button>
        )}
      </div>
      {approving && (
        <div className="space-y-1">
          <Input
            value={reason}
            maxLength={300}
            placeholder="Why the name difference is fine (e.g. checked passbook: joint account)"
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void approve()} disabled={busy || reason.trim().length < 5}>
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setApproving(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
