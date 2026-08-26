import { useEffect, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function PujariBankPage() {
  const [holder, setHolder] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [last4, setLast4] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      await api("/pujari/profile", {
        method: "PATCH",
        body: JSON.stringify({
          bank_holder_name: holder || null,
          bank_ifsc: ifsc || null,
          bank_account_last4: last4 || null,
        }),
      });
      toast.success("Bank details saved");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <PujariPortal>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="font-heading">Bank / Settlement</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <form className="space-y-4" onSubmit={save}>
              <div className="space-y-2">
                <Label>Account holder name</Label>
                <Input value={holder} onChange={(e) => setHolder(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>IFSC</Label>
                <Input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-2">
                <Label>Account number (last 4 digits)</Label>
                <Input
                  maxLength={4}
                  value={last4}
                  onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
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
