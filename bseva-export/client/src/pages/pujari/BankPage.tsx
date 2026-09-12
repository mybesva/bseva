import { useEffect, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { validateBank } from "@/lib/fieldValidation";
import { toast } from "sonner";

export default function PujariBankPage() {
  const [holder, setHolder] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [last4, setLast4] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api<any>("/pujari/profile")
      .then((p) => {
        setHolder(p.bank_holder_name || "");
        setIfsc(p.bank_ifsc || "");
        setLast4(p.bank_account_last4 || "");
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateBank({ holder, ifsc, last4 });
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Please fill all mandatory bank fields correctly");
      return;
    }
    setSaving(true);
    try {
      await api("/pujari/profile", {
        method: "PATCH",
        body: JSON.stringify({
          bank_holder_name: holder.trim(),
          bank_ifsc: ifsc.trim().toUpperCase(),
          bank_account_last4: last4.trim(),
        }),
      });
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
                <Input value={holder} onChange={(e) => setHolder(e.target.value)} required />
                {errors.holder && <p className="text-sm text-destructive">{errors.holder}</p>}
              </div>
              <div className="space-y-1">
                <Label>IFSC *</Label>
                <Input
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  maxLength={11}
                  required
                />
                {errors.ifsc && <p className="text-sm text-destructive">{errors.ifsc}</p>}
              </div>
              <div className="space-y-1">
                <Label>Account number (last 4) *</Label>
                <Input
                  value={last4}
                  onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4}
                  required
                />
                {errors.last4 && <p className="text-sm text-destructive">{errors.last4}</p>}
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
