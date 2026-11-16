import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, rupees } from "@/lib/api";
import { formatDisplayDateTime } from "@/lib/formatDate";

type BalanceRow = {
  user_id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  balance_paise: number;
  status?: string | null;
  last_activity_at?: string | null;
  refunded_paise?: number | null;
};

type RefundMethod = "upi" | "bank_transfer" | "other";

/**
 * Super Admin: customers still holding wallet money (for when the customer wallet is switched off). "Mark refunded"
 * only records a payment B-Seva made outside the app (UPI / bank transfer) and debits the wallet by that amount.
 */
export default function CustomerWalletBalancesPanel() {
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<BalanceRow | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<RefundMethod>("upi");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ items: BalanceRow[]; total_paise: number }>("/admin/wallets/customer-balances");
      setRows(res.items || []);
      setTotal(Number(res.total_paise || 0));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openRefund(row: BalanceRow) {
    setTarget(row);
    setAmount(String((row.balance_paise || 0) / 100));
    setMethod("upi");
    setReference("");
    setNote("");
  }

  const amountPaise = Math.round(Number(amount || 0) * 100);
  const refTrimmed = reference.trim();
  const amountError =
    !target ? null : !(amountPaise > 0) ? "Enter an amount above ₹0." : amountPaise > target.balance_paise ? "More than the wallet balance." : null;
  const referenceError = refTrimmed.length < 4 || refTrimmed.length > 80 ? "Enter the UPI reference or bank UTR (4–80 characters)." : null;

  async function saveRefund() {
    if (!target || amountError || referenceError) return;
    setSaving(true);
    try {
      await api(`/admin/wallets/${encodeURIComponent(target.user_id)}/manual-refund`, {
        method: "POST",
        body: JSON.stringify({
          amount_paise: amountPaise,
          method,
          reference: refTrimmed,
          note: note.trim() || undefined,
        }),
      });
      toast.success(`Recorded ${rupees(amountPaise)} refunded to ${target.name || "customer"}`);
      setTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Customer Wallet Balances</CardTitle>
        <p className="text-sm text-muted-foreground">
          Customers who still have money in their wallet. Pay them outside the app (UPI or bank transfer), then mark
          it refunded here with the payment reference. Total held: <span className="font-medium">{rupees(total)}</span>
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No customer has a wallet balance.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Refunded</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell className="font-medium">
                      {row.name || "—"}
                      {row.status && row.status !== "active" ? (
                        <span className="ml-1 text-xs text-muted-foreground">({row.status})</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{row.phone || "—"}</div>
                      <div>{row.email || ""}</div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{rupees(row.balance_paise)}</TableCell>
                    <TableCell className="text-right">{row.refunded_paise ? rupees(row.refunded_paise) : "—"}</TableCell>
                    <TableCell className="text-sm">
                      {row.last_activity_at ? formatDisplayDateTime(row.last_activity_at) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" disabled={row.balance_paise <= 0} onClick={() => openRefund(row)}>
                        Mark Refunded
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && !saving && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Wallet Refunded</DialogTitle>
          </DialogHeader>
          {target ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {target.name || "Customer"} · balance {rupees(target.balance_paise)}. This only records a payment you
                have already made outside the app; it does not send money.
              </p>
              <div className="space-y-1">
                <Label htmlFor="wallet-refund-amount">Amount (₹)</Label>
                <Input
                  id="wallet-refund-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {amountError ? <p className="text-xs text-destructive">{amountError}</p> : null}
              </div>
              <div className="space-y-1">
                <Label>Paid By</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as RefundMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="wallet-refund-ref">Reference (UPI Ref / Bank UTR)</Label>
                <Input
                  id="wallet-refund-ref"
                  value={reference}
                  maxLength={80}
                  onChange={(e) => setReference(e.target.value)}
                />
                {reference && referenceError ? <p className="text-xs text-destructive">{referenceError}</p> : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor="wallet-refund-note">Note (Optional)</Label>
                <Textarea id="wallet-refund-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button disabled={saving || Boolean(amountError) || Boolean(referenceError)} onClick={() => void saveRefund()}>
              {saving ? "Saving…" : "Mark Refunded"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
