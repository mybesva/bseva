import { useEffect, useMemo, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { validateBank } from "@/lib/fieldValidation";
import { toast } from "sonner";

type BankDraft = {
  holder: string;
  ifsc: string;
  accountNumber: string;
  accountConfirm: string;
};

const empty: BankDraft = { holder: "", ifsc: "", accountNumber: "", accountConfirm: "" };

export default function PujariBankPage() {
  const [draft, setDraft] = useState<BankDraft>(empty);
  const [baseline, setBaseline] = useState<BankDraft>(empty);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api<any>("/pujari/profile")
      .then((p) => {
        const acct = String(p.bank_account_number || "").replace(/\D/g, "");
        const next: BankDraft = {
          holder: p.bank_holder_name || "",
          ifsc: p.bank_ifsc || "",
          accountNumber: acct,
          accountConfirm: acct,
        };
        setDraft(next);
        setBaseline(next);
        setEditing(false);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const dirty = useMemo(
    () =>
      draft.holder.trim() !== baseline.holder.trim() ||
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !dirty) return;
    const errs = validateBank({
      holder: draft.holder,
      ifsc: draft.ifsc,
      accountNumber: draft.accountNumber,
      accountConfirm: draft.accountConfirm,
    });
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Please fill all mandatory bank fields correctly");
      return;
    }
    setSaving(true);
    try {
      const digits = draft.accountNumber.replace(/\D/g, "");
      await api("/pujari/profile", {
        method: "PATCH",
        body: JSON.stringify({
          bank_holder_name: draft.holder.trim(),
          bank_ifsc: draft.ifsc.trim().toUpperCase(),
          bank_account_number: digits,
          bank_account_confirm: draft.accountConfirm.replace(/\D/g, ""),
          bank_account_last4: digits.slice(-4),
        }),
      });
      const saved: BankDraft = {
        holder: draft.holder.trim(),
        ifsc: draft.ifsc.trim().toUpperCase(),
        accountNumber: digits,
        accountConfirm: digits,
      };
      setDraft(saved);
      setBaseline(saved);
      setEditing(false);
      setErrors({});
      toast.success("Bank details saved");
    } catch (err: any) {
      toast.error(err.message || "Could not save bank details");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PujariPortal>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Bank / Settlement</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <form className="space-y-4" onSubmit={save}>
              <div className="space-y-1">
                <Label>Account holder name *</Label>
                <Input
                  value={draft.holder}
                  onChange={(e) => setField("holder", e.target.value)}
                  disabled={!editing}
                  required
                />
                {errors.holder && <p className="text-sm text-destructive">{errors.holder}</p>}
              </div>
              <div className="space-y-1">
                <Label>IFSC *</Label>
                <Input
                  value={draft.ifsc}
                  onChange={(e) => setField("ifsc", e.target.value.toUpperCase())}
                  maxLength={11}
                  disabled={!editing}
                  required
                />
                {errors.ifsc && <p className="text-sm text-destructive">{errors.ifsc}</p>}
              </div>
              <div className="space-y-1">
                <Label>Account number *</Label>
                <Input
                  value={draft.accountNumber}
                  onChange={(e) => setField("accountNumber", e.target.value.replace(/\D/g, "").slice(0, 18))}
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={!editing}
                  required
                />
                {errors.accountNumber && <p className="text-sm text-destructive">{errors.accountNumber}</p>}
              </div>
              <div className="space-y-1">
                <Label>Confirm account number *</Label>
                <Input
                  value={draft.accountConfirm}
                  onChange={(e) => setField("accountConfirm", e.target.value.replace(/\D/g, "").slice(0, 18))}
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={!editing}
                  required
                />
                {errors.accountConfirm && (
                  <p className="text-sm text-destructive">{errors.accountConfirm}</p>
                )}
              </div>
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
            </form>
          )}
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
