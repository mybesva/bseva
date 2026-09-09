import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { toast } from "sonner";

function paise(n: number | null | undefined) {
  return `₹${((n || 0) / 100).toLocaleString("en-IN")}`;
}

export default function AdminSettlements() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [holdDays, setHoldDays] = useState(14);
  const [active, setActive] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [list, cfg] = await Promise.all([
        api<any[]>("/settlements"),
        api<Record<string, unknown>>("/admin/config").catch(() => ({})),
      ]);
      setRows(list || []);
      const days = Number(cfg?.pujari_settlement_days ?? 14);
      if (Number.isFinite(days) && days > 0) setHoldDays(days);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function settle() {
    if (!active) return;
    if (reason.trim().length < 3) {
      toast.error("Reason required");
      return;
    }
    setSaving(true);
    try {
      await api(`/settlements/${active.id}/override`, {
        method: "POST",
        body: JSON.stringify({
          reason: reason.trim(),
          mark_settled: true,
          payment_reference: ref.trim() || null,
        }),
      });
      toast.success("Settlement marked settled (override)");
      setActive(null);
      setReason("");
      setRef("");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const pending = rows.filter((s) => s.status === "pending" || s.status === "eligible").length;
  const settled = rows.filter((s) => s.status === "settled").length;

  return (
    <AdminLayout>
      <h1 className="text-h1 mb-2">Settlements</h1>
      <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
        Pujari earnings settle automatically every <strong>{holdDays} days</strong> (about 2 weeks) after a
        completed puja. When the due date arrives, the pujari wallet is credited without manual action.
        Use <strong>Settle / override</strong> only for early payout or special cases.
      </p>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Auto cycle</p>
            <p className="text-lg font-semibold text-primary">Every {holdDays} days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Awaiting cycle</p>
            <p className="text-lg font-semibold">{pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Settled</p>
            <p className="text-lg font-semibold">{settled}</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No settlements yet.</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Customer paid</TableHead>
                <TableHead>Platform fee</TableHead>
                <TableHead>Pujari payable</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{String(s.booking_id || "").slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "settled" ? "default" : "secondary"}>
                      {s.status}
                      {s.status === "settled" && s.payment_reference === "AUTO_BIWEEKLY" ? " · auto" : ""}
                      {s.status === "settled" && s.override_flag ? " · override" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell>{s.due_date || "—"}</TableCell>
                  <TableCell>{paise(s.customer_payment_paise)}</TableCell>
                  <TableCell>{paise(s.platform_fee_paise)}</TableCell>
                  <TableCell>{paise(s.settlement_amount_paise)}</TableCell>
                  <TableCell>
                    {s.status !== "settled" && (
                      <Button size="sm" variant="outline" onClick={() => setActive(s)}>
                        Settle / override
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override — settle early</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Normally this settles automatically on the due date ({active?.due_date || "—"}). Override credits the
              pujari wallet now with {paise(active?.settlement_amount_paise)}.
            </p>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Payment reference (optional)</Label>
              <Input value={ref} onChange={(e) => setRef(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>
              Cancel
            </Button>
            <Button onClick={() => void settle()} disabled={saving}>
              {saving ? "Saving…" : "Confirm override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
