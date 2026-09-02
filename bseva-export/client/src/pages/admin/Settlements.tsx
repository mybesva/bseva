import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [active, setActive] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await api<any[]>("/settlements"));
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
      toast.success("Settlement marked settled");
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

  return (
    <AdminLayout>
      <h1 className="text-2xl font-heading font-bold mb-6">Settlements</h1>
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
                    <Badge variant={s.status === "settled" ? "default" : "secondary"}>{s.status}</Badge>
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
            <DialogTitle>Mark settlement paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Credits pujari wallet with {paise(active?.settlement_amount_paise)} and marks settled.
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
              {saving ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
