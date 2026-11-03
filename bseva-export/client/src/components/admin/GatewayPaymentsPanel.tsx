import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/_core/hooks/useAuth";
import { api, rupees } from "@/lib/api";
import { formatDisplayDate } from "@/lib/formatDate";

type Summary = {
  gateways: Record<string, any>;
  payments: Record<string, number>;
  refunds: Record<string, number>;
  payouts: Record<string, number>;
  awaiting_payment_bookings: number;
  needs_review: {
    payments: number; refunds: number; payouts: number; unverified_webhooks_24h: number;
    booking_follow_ups_failed: number; booking_follow_ups_pending: number;
  };
};

const tone = (s: string) =>
  ["successful", "settled"].includes(s) ? "default" : ["failed", "reversed", "manual_review", "expired"].includes(s) ? "destructive" : "secondary";

function when(v?: string | null) {
  return v ? formatDisplayDate(v) + " " + new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
}

/** Gateway (Cashfree) payments, refunds, payouts and webhook log. Statuses are what the provider reported. */
export default function GatewayPaymentsPanel() {
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";
  const [summary, setSummary] = useState<Summary | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [methods, setMethods] = useState<{ method: string; eligible: boolean }[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, p, r] = await Promise.all([
        api<Summary>("/admin/payments/summary"),
        api<{ items: any[] }>("/admin/payments/transactions?provider=cashfree&limit=50"),
        api<{ items: any[] }>("/admin/payments/refunds?limit=50"),
      ]);
      setSummary(s);
      setPayments(p.items);
      setRefunds(r.items);
      if (isSuper) {
        const [po, ev, fu] = await Promise.all([
          api<{ items: any[] }>("/admin/payouts?limit=50"),
          api<{ items: any[] }>("/admin/payments/events?limit=50"),
          api<{ items: any[] }>("/admin/payments/follow-ups?status=failed"),
        ]);
        setPayouts(po.items);
        setEvents(ev.items);
        setFollowUps(fu.items);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [isSuper]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const cf = summary?.gateways?.cashfree;
  const po = summary?.gateways?.payouts;
  return (
    <Card className="mb-6">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-semibold">Online payments (Cashfree)</p>
            <p className="text-muted-foreground">
              Gateway: {cf?.configured ? `configured · ${cf.environment}` : "not configured"}
              {summary?.gateways?.selected_gateway ? ` · new checkouts: ${summary.gateways.selected_gateway}` : " · new checkouts: wallet only"}
              {" · "}Payouts: {po?.configured ? `configured · ${po.environment}${po.two_factor_key ? " · 2FA key" : ""}` : "not configured"}
            </p>
          </div>
          {isSuper && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Reconciliation finished", () => api("/admin/payments/reconcile", { method: "POST" }))}>
                Reconcile now
              </Button>
              <Button size="sm" variant="outline" disabled={busy || !cf?.configured}
                onClick={() => run("Checked with Cashfree", async () => setMethods((await api<{ methods: any[] }>("/admin/payments/methods")).methods))}>
                Check enabled methods
              </Button>
            </div>
          )}
        </div>
        {summary && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">Awaiting payment: {summary.awaiting_payment_bookings}</Badge>
            <Badge variant={summary.needs_review.payments ? "destructive" : "secondary"}>Amount mismatches: {summary.needs_review.payments}</Badge>
            <Badge variant={summary.needs_review.refunds ? "destructive" : "secondary"}>Refunds needing action: {summary.needs_review.refunds}</Badge>
            <Badge variant={summary.needs_review.payouts ? "destructive" : "secondary"}>Failed / reversed payouts: {summary.needs_review.payouts}</Badge>
            <Badge variant={summary.needs_review.booking_follow_ups_failed ? "destructive" : "secondary"}>
              Booking follow-ups failed: {summary.needs_review.booking_follow_ups_failed}
              {summary.needs_review.booking_follow_ups_pending ? ` · overdue: ${summary.needs_review.booking_follow_ups_pending}` : ""}
            </Badge>
            <Badge variant={summary.needs_review.unverified_webhooks_24h ? "destructive" : "secondary"}>
              Unverified webhooks (24h): {summary.needs_review.unverified_webhooks_24h}
            </Badge>
          </div>
        )}
        {methods && (
          <p className="text-xs text-muted-foreground">
            Eligible on this account: {methods.filter((m) => m.eligible).map((m) => m.method).join(", ") || "none reported"}
          </p>
        )}
        <Tabs defaultValue="payments">
          <TabsList>
            <TabsTrigger value="payments">Gateway payments</TabsTrigger>
            <TabsTrigger value="refunds">Refunds</TabsTrigger>
            {isSuper && <TabsTrigger value="payouts">Pujari payouts</TabsTrigger>}
            {isSuper && <TabsTrigger value="events">Webhooks</TabsTrigger>}
            {isSuper && <TabsTrigger value="follow-ups">Booking follow-ups</TabsTrigger>}
          </TabsList>
          <TabsContent value="payments" className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead><TableHead>Order / attempt</TableHead><TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Refunded</TableHead><TableHead>Verified</TableHead><TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.booking_number}</TableCell>
                    <TableCell className="font-mono text-xs">{p.provider_order_id} · #{p.attempt_no}</TableCell>
                    <TableCell>
                      <Badge variant={tone(p.status) as any}>{p.status}{p.duplicate_of ? " · duplicate" : ""}</Badge>
                      {p.failure_reason && <div className="text-xs text-muted-foreground">{p.failure_reason}</div>}
                    </TableCell>
                    <TableCell>{rupees(p.amount_paise)}</TableCell>
                    <TableCell>{p.payment_method || "—"}</TableCell>
                    <TableCell>{p.refunded_paise ? rupees(p.refunded_paise) : "—"}</TableCell>
                    <TableCell className="text-xs">{when(p.verified_at)}</TableCell>
                    <TableCell>
                      {isSuper && ["pending", "processing"].includes(p.status) && (
                        <Button size="sm" variant="outline" disabled={busy}
                          onClick={() => run("Re-checked with Cashfree", () => api(`/admin/payments/${p.id}/verify`, { method: "POST" }))}>
                          Re-check
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!payments.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No gateway payments yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>
          <TabsContent value="refunds" className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead><TableHead>Refund id</TableHead><TableHead>Kind</TableHead><TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead><TableHead>Amount</TableHead><TableHead>Created</TableHead><TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {refunds.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.booking_number}</TableCell>
                    <TableCell className="font-mono text-xs">{r.refund_id}</TableCell>
                    <TableCell>{r.kind}</TableCell>
                    <TableCell>{r.provider}</TableCell>
                    <TableCell>
                      <Badge variant={tone(r.status) as any}>{r.status}</Badge>
                      {r.failure_reason && <div className="text-xs text-muted-foreground">{r.failure_reason}</div>}
                    </TableCell>
                    <TableCell>{rupees(r.amount_paise)}</TableCell>
                    <TableCell className="text-xs">{when(r.created_at)}</TableCell>
                    <TableCell>
                      {isSuper && ["pending", "processing", "failed", "manual_review"].includes(r.status) && (
                        <Button size="sm" variant="outline" disabled={busy}
                          onClick={() => run("Refund re-submitted", () => api(`/admin/payments/refunds/${r.refund_id}/retry`, { method: "POST" }))}>
                          {["failed", "manual_review"].includes(r.status) ? "Retry" : "Re-check"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!refunds.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No gateway refunds yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>
          {isSuper && (
            <TabsContent value="payouts" className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pujari</TableHead><TableHead>Booking</TableHead><TableHead>Transfer</TableHead><TableHead>Destination</TableHead>
                    <TableHead>Status</TableHead><TableHead>Amount</TableHead><TableHead>UTR</TableHead><TableHead>Approved by</TableHead><TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.pujari_name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.booking_number}</TableCell>
                      <TableCell className="font-mono text-xs">{p.transfer_id} · {p.transfer_mode}</TableCell>
                      <TableCell className="text-xs">{p.destination}</TableCell>
                      <TableCell>
                        <Badge variant={tone(p.status) as any}>{p.status}</Badge>
                        {p.status_detail && <div className="text-xs text-muted-foreground">{p.status_detail}</div>}
                      </TableCell>
                      <TableCell>{rupees(p.amount_paise)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.utr || "—"}</TableCell>
                      <TableCell>{p.initiated_by_name || "—"}</TableCell>
                      <TableCell>
                        {["initiated", "pending", "successful"].includes(p.status) && (
                          <Button size="sm" variant="outline" disabled={busy}
                            onClick={() => run("Re-checked with Cashfree", () => api(`/admin/payouts/${p.id}/refresh`, { method: "POST" }))}>
                            Re-check
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!payouts.length && <TableRow><TableCell colSpan={9} className="py-6 text-center text-muted-foreground">No bank payouts yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TabsContent>
          )}
          {isSuper && (
            <TabsContent value="events" className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Received</TableHead><TableHead>Channel</TableHead><TableHead>Type</TableHead><TableHead>Reference</TableHead>
                    <TableHead>Signature</TableHead><TableHead>Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{when(e.received_at)}</TableCell>
                      <TableCell>{e.channel}</TableCell>
                      <TableCell className="text-xs">{e.event_type || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{e.reference || "—"}</TableCell>
                      <TableCell><Badge variant={e.signature_valid ? "secondary" : "destructive"}>{e.signature_valid ? "verified" : "rejected"}</Badge></TableCell>
                      <TableCell className="text-xs">{e.outcome || (e.processed_at ? "processed" : "not processed")}</TableCell>
                    </TableRow>
                  ))}
                  {!events.length && <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No webhooks received yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TabsContent>
          )}
          {isSuper && (
            <TabsContent value="follow-ups" className="overflow-x-auto">
              <p className="mb-2 text-xs text-muted-foreground">
                Offers, notifications, confirmation email and invoice for paid bookings that failed repeatedly. Each runs at most once.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking</TableHead><TableHead>Task</TableHead><TableHead>Attempts</TableHead><TableHead>Last error</TableHead><TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {followUps.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-xs">{f.booking_number}</TableCell>
                      <TableCell>{f.effect}</TableCell>
                      <TableCell>{f.attempts}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs" title={f.last_error}>{f.last_error}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" disabled={busy}
                          onClick={() => run("Task retried", () => api(`/admin/payments/follow-ups/${f.id}/retry`, { method: "POST" }))}>
                          Retry
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!followUps.length && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No failed follow-ups.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
