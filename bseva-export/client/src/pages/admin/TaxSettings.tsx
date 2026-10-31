import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import AdminPageHeader from "@/components/AdminPageHeader";
import { TAX_LINE_LABELS, TaxRateForm } from "@/components/admin/TaxRateForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatDisplayDateTime } from "@/lib/formatDate";
import { toast } from "sonner";

type TaxConfig = {
  supplier: { gstin: string; state: string; state_code: string | null };
  states: { code: string; name: string }[];
  known_codes: { code: string; label: string }[];
  current: Record<string, { hsn_sac?: string | null; gst_rate: number | string; classification: string } | null>;
};
type AuditRow = { action: string; details: Record<string, unknown>; created_at: string; actor_name?: string | null };

const AUDIT_LABELS: Record<string, string> = { supplier_updated: "Supplier details changed", rate_added: "GST setting added" };

export default function TaxSettings() {
  const [config, setConfig] = useState<TaxConfig | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [gstin, setGstin] = useState("");
  const [state, setState] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await api<TaxConfig>("/admin/tax/config");
    setConfig(data);
    setGstin(data.supplier.gstin);
    setState(data.supplier.state);
    setAudit(await api<AuditRow[]>("/admin/tax/audit"));
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  async function saveSupplier() {
    setSaving(true);
    try {
      await api("/admin/tax/supplier", { method: "PUT", body: JSON.stringify({ gstin, state }) });
      toast.success("Supplier details saved");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <AdminPageHeader
        title="GST & Tax"
        description="Supplier registration and default GST for new bookings. Set a different code or rate for one puja in Services → Edit → Pricing. Issued invoices never change."
      />
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supplier registration</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="supplier-gstin">Supplier GSTIN</Label>
              <Input
                id="supplier-gstin"
                maxLength={15}
                placeholder="36AAAAA0000A1Z5"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1">
              <Label>Registered State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent>
                  {(config?.states || []).map((s) => (
                    <SelectItem key={s.code} value={s.name}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={saving || !gstin.trim() || !state} onClick={() => void saveSupplier()}>
              Save
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Default GST</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(TAX_LINE_LABELS).map(([key, label]) => {
                const row = config?.current[key];
                return (
                  <div key={key} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-semibold">
                      {!row ? "Not set" : row.classification === "taxable" ? `${Number(row.gst_rate)}%` : row.classification === "exempt" ? "Exempt" : "Nil-rated"}
                    </p>
                    <p className={row?.hsn_sac ? "text-xs text-muted-foreground" : "text-xs font-medium text-red-700"}>
                      {row?.hsn_sac || "HSN/SAC missing"}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Common service codes: {(config?.known_codes || []).map((c) => `${c.code} ${c.label}`).join(" · ")}
            </p>
            <TaxRateForm onSaved={() => void load()} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change history</CardTitle>
          </CardHeader>
          <CardContent>
            {audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {audit.map((a, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-x-3">
                    <span>{AUDIT_LABELS[a.action] || a.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.actor_name || "—"} · {formatDisplayDateTime(a.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
