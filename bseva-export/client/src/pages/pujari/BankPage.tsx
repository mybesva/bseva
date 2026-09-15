import { useEffect, useMemo, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PujariOnboardingWalkthrough, { usePujariOnboardingGate } from "@/components/PujariOnboardingWalkthrough";
import { api } from "@/lib/api";
import {
  bankDraftTouched,
  hasSettlementMethod,
  validateSettlement,
} from "@/lib/fieldValidation";
import { toast } from "sonner";

type BankDraft = {
  upiId: string;
  holder: string;
  bankName: string;
  ifsc: string;
  accountNumber: string;
  accountConfirm: string;
};

const empty: BankDraft = {
  upiId: "",
  holder: "",
  bankName: "",
  ifsc: "",
  accountNumber: "",
  accountConfirm: "",
};

function buildPayload(draft: BankDraft): Record<string, string> {
  const payload: Record<string, string> = {};
  const upi = draft.upiId.trim().toLowerCase();
  const digits = draft.accountNumber.replace(/\D/g, "");
  const bankComplete =
    draft.holder.trim() &&
    draft.bankName.trim() &&
    draft.ifsc.trim() &&
    digits.length >= 9 &&
    draft.accountConfirm.replace(/\D/g, "") === digits;

  if (upi) payload.upi_id = upi;
  if (bankComplete) {
    payload.bank_holder_name = draft.holder.trim();
    payload.bank_name = draft.bankName.trim();
    payload.bank_ifsc = draft.ifsc.trim().toUpperCase();
    payload.bank_account_number = digits;
    payload.bank_account_confirm = draft.accountConfirm.replace(/\D/g, "");
    payload.bank_account_last4 = digits.slice(-4);
  }
  return payload;
}

export default function PujariBankPage() {
  const { active: onboardingActive } = usePujariOnboardingGate("bank");
  const [draft, setDraft] = useState<BankDraft>(empty);
  const [baseline, setBaseline] = useState<BankDraft>(empty);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [walkthroughErrors, setWalkthroughErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api<any>("/pujari/profile")
      .then((p) => {
        const acct = String(p.bank_account_number || "").replace(/\D/g, "");
        const next: BankDraft = {
          upiId: p.upi_id || "",
          holder: p.bank_holder_name || "",
          bankName: p.bank_name || "",
          ifsc: p.bank_ifsc || "",
          accountNumber: acct,
          accountConfirm: acct,
        };
        setDraft(next);
        setBaseline(next);
        setEditing(!hasSettlementMethod(next));
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const inputsEnabled = onboardingActive || editing;

  const dirty = useMemo(
    () =>
      draft.upiId.trim().toLowerCase() !== baseline.upiId.trim().toLowerCase() ||
      draft.holder.trim() !== baseline.holder.trim() ||
      draft.bankName.trim() !== baseline.bankName.trim() ||
      draft.ifsc.trim().toUpperCase() !== baseline.ifsc.trim().toUpperCase() ||
      draft.accountNumber !== baseline.accountNumber ||
      draft.accountConfirm !== baseline.accountConfirm,
    [draft, baseline],
  );

  function setField<K extends keyof BankDraft>(key: K, value: BankDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function cancelEdit() {
    setDraft(baseline);
    setErrors({});
    setEditing(false);
  }

  async function persistBankDraft(): Promise<boolean> {
    const emptyDraft =
      !draft.upiId.trim() &&
      !draft.holder.trim() &&
      !draft.bankName.trim() &&
      !draft.ifsc.trim() &&
      !draft.accountNumber.replace(/\D/g, "");
    if (emptyDraft) return true;

    const errs = validateSettlement({
      upiId: draft.upiId,
      holder: draft.holder,
      bankName: draft.bankName,
      ifsc: draft.ifsc,
      accountNumber: draft.accountNumber,
      accountConfirm: draft.accountConfirm,
    });
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error(errs.settlement || "Please add UPI ID or complete bank details correctly");
      return false;
    }

    const payload = buildPayload(draft);
    if (!Object.keys(payload).length) {
      toast.error("Add a UPI ID or complete bank account details");
      return false;
    }

    setSaving(true);
    try {
      await api("/pujari/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const saved: BankDraft = {
        upiId: draft.upiId.trim().toLowerCase(),
        holder: draft.holder.trim(),
        bankName: draft.bankName.trim(),
        ifsc: draft.ifsc.trim().toUpperCase(),
        accountNumber: draft.accountNumber.replace(/\D/g, ""),
        accountConfirm: draft.accountConfirm.replace(/\D/g, ""),
      };
      setDraft(saved);
      setBaseline(saved);
      setEditing(onboardingActive);
      setErrors({});
      if (!onboardingActive) toast.success("Settlement details saved");
      return true;
    } catch (err: any) {
      toast.error(err.message || "Could not save settlement details");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function persistBank(): Promise<boolean> {
    if (!editing) {
      if (!hasSettlementMethod(baseline)) {
        toast.error("Add a UPI ID or bank account details");
        return false;
      }
      return true;
    }
    if (!dirty) return true;
    return persistBankDraft();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (onboardingActive) return;
    if (!(await persistBank())) return;
    toast.success("Settlement details saved");
  }

  const bankSectionActive = bankDraftTouched(draft);

  return (
    <PujariPortal>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Bank / UPI settlement</CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Add a UPI ID or bank account details. At least one is required for payouts.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <form className="space-y-4" onSubmit={save}>
              {errors.settlement && (
                <p className="text-sm text-destructive">{errors.settlement}</p>
              )}

              <div className="space-y-1">
                <Label>UPI ID</Label>
                <Input
                  value={draft.upiId}
                  onChange={(e) => setField("upiId", e.target.value.trim().toLowerCase())}
                  placeholder="yourname@oksbi"
                  autoComplete="off"
                  disabled={!inputsEnabled}
                />
                {errors.upiId && <p className="text-sm text-destructive">{errors.upiId}</p>}
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or bank account</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Account holder name{bankSectionActive ? " *" : ""}</Label>
                <Input
                  value={draft.holder}
                  onChange={(e) => setField("holder", e.target.value)}
                  disabled={!inputsEnabled}
                />
                {errors.holder && <p className="text-sm text-destructive">{errors.holder}</p>}
              </div>
              <div className="space-y-1">
                <Label>Bank name{bankSectionActive ? " *" : ""}</Label>
                <Input
                  value={draft.bankName}
                  onChange={(e) => setField("bankName", e.target.value)}
                  placeholder="e.g. State Bank of India"
                  disabled={!inputsEnabled}
                />
                {errors.bankName && <p className="text-sm text-destructive">{errors.bankName}</p>}
              </div>
              <div className="space-y-1">
                <Label>IFSC{bankSectionActive ? " *" : ""}</Label>
                <Input
                  value={draft.ifsc}
                  onChange={(e) => setField("ifsc", e.target.value.toUpperCase())}
                  maxLength={11}
                  disabled={!inputsEnabled}
                />
                {errors.ifsc && <p className="text-sm text-destructive">{errors.ifsc}</p>}
              </div>
              <div className="space-y-1">
                <Label>Account number{bankSectionActive ? " *" : ""}</Label>
                <Input
                  value={draft.accountNumber}
                  onChange={(e) => setField("accountNumber", e.target.value.replace(/\D/g, "").slice(0, 18))}
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={!inputsEnabled}
                />
                {errors.accountNumber && <p className="text-sm text-destructive">{errors.accountNumber}</p>}
              </div>
              <div className="space-y-1">
                <Label>Confirm account number{bankSectionActive ? " *" : ""}</Label>
                <Input
                  value={draft.accountConfirm}
                  onChange={(e) => setField("accountConfirm", e.target.value.replace(/\D/g, "").slice(0, 18))}
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={!inputsEnabled}
                />
                {errors.accountConfirm && (
                  <p className="text-sm text-destructive">{errors.accountConfirm}</p>
                )}
              </div>

              {!onboardingActive ? (
                <div className="flex flex-wrap gap-2">
                  {!editing ? (
                    <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                      Edit
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving}>
                      Cancel
                    </Button>
                  )}
                  <Button type="submit" disabled={saving || !editing || !dirty}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              ) : null}
              <PujariOnboardingWalkthrough
                page="bank"
                saving={saving}
                fieldErrors={walkthroughErrors}
                onFieldErrors={(errs) => {
                  setWalkthroughErrors(errs);
                  setErrors({
                    upiId: errs.upi_id,
                    settlement: errs.settlement,
                    holder: errs.bank_holder_name,
                    bankName: errs.bank_name,
                    ifsc: errs.bank_ifsc,
                    accountNumber: errs.bank_account_number,
                    accountConfirm: errs.bank_account_number,
                  });
                }}
                beforeContinue={persistBankDraft}
              />
            </form>
          )}
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
