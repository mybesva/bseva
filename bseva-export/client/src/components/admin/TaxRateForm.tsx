import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatDisplayDate } from "@/lib/formatDate";
import { toast } from "sonner";

export const TAX_LINE_LABELS: Record<string, string> = {
  puja: "Main puja",
  surge: "Weekend / festival surge",
  samagri: "Samagri kit",
  alankaram: "Alankaram",
  food: "Food / Prasadam",
};
const CLASSIFICATION_LABELS: Record<string, string> = {
  taxable: "Taxable",
  exempt: "Exempt",
  nil_rated: "Nil-rated",
};

export type TaxRateRow = {
  id: string;
  line_type: string;
  package_type?: string | null;
  hsn_sac?: string | null;
  gst_rate: number | string;
  classification: string;
  effective_from: string;
  created_by_name?: string | null;
};

function today() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Add a dated GST setting. Earlier rows are kept, so issued invoices and history never change. */
export function TaxRateForm({ serviceId, onSaved }: { serviceId?: string; onSaved?: () => void }) {
  const [rows, setRows] = useState<TaxRateRow[]>([]);
  const [lineType, setLineType] = useState("puja");
  const [hsn, setHsn] = useState("");
  const [classification, setClassification] = useState("taxable");
  const [rate, setRate] = useState("");
  const [from, setFrom] = useState(today());
  const [saving, setSaving] = useState(false);

  async function load() {
    const q = serviceId ? `?service_id=${serviceId}` : "";
    setRows(await api<TaxRateRow[]>(`/admin/tax/rates${q}`));
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, [serviceId]);

  async function save() {
    setSaving(true);
    try {
      await api("/admin/tax/rates", {
        method: "POST",
        body: JSON.stringify({
          line_type: lineType,
          service_id: serviceId || null,
          hsn_sac: hsn.trim(),
          classification,
          gst_rate: classification === "taxable" ? rate : "0",
          effective_from: from,
        }),
      });
      toast.success("GST setting saved");
      setHsn("");
      setRate("");
      await load();
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="space-y-1">
          <Label>Applies to</Label>
          <Select value={lineType} onValueChange={setLineType}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TAX_LINE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="tax-hsn">HSN/SAC code</Label>
          <Input id="tax-hsn" inputMode="numeric" placeholder="e.g. 999591" value={hsn} onChange={(e) => setHsn(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Tax treatment</Label>
          <Select value={classification} onValueChange={setClassification}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CLASSIFICATION_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="tax-rate">GST rate (%)</Label>
          <Input
            id="tax-rate"
            inputMode="decimal"
            placeholder="e.g. 18"
            disabled={classification !== "taxable"}
            value={classification === "taxable" ? rate : "0"}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tax-from">Effective from</Label>
          <Input id="tax-from" type="date" min={today()} value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={saving || !hsn.trim() || (classification === "taxable" && !rate.trim())}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save GST setting"}
      </Button>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">History</p>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {serviceId ? "None yet. This puja uses the defaults on the GST & Tax page." : "None yet."}
          </p>
        ) : (
          <ul className="max-h-44 space-y-1 overflow-y-auto text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-x-3">
                <span>
                  {TAX_LINE_LABELS[r.line_type] || r.line_type} · {r.hsn_sac || "No code"} ·{" "}
                  {r.classification === "taxable" ? `${Number(r.gst_rate)}%` : CLASSIFICATION_LABELS[r.classification]}
                </span>
                <span className="text-xs text-muted-foreground">
                  from {formatDisplayDate(r.effective_from)}
                  {r.created_by_name ? ` · ${r.created_by_name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
