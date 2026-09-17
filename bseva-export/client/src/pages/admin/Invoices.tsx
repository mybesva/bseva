import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import AdminPageHeader from "@/components/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, apiBase, downloadInvoicePdf, getToken, rupees } from "@/lib/api";
import { formatDisplayDateTime } from "@/lib/formatDate";
import { toast } from "sonner";
import { adminPath } from "@/const";
import { Link } from "wouter";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_type: string;
  booking_id?: string;
  booking_number?: string;
  customer_name?: string;
  customer_email?: string;
  total_paise: number;
  payment_status?: string;
  email_status?: string;
  created_at?: string;
};

export default function AdminInvoices() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load(search = q) {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ invoice_type: "all", q: search.trim() });
      setRows(await api<InvoiceRow[]>(`/admin/invoices?${qs.toString()}`));
    } catch (e: any) {
      toast.error(e.message || "Could not load invoices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openHtml(id: string) {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase()}/api/v1/invoices/${id}/html`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Could not open invoice");
      const html = await res.text();
      const w = window.open("", "_blank");
      if (!w) {
        toast.error("Allow pop-ups to view the invoice");
        return;
      }
      w.document.write(html);
      w.document.close();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function resend(id: string) {
    setBusy(id);
    try {
      await api(`/invoices/${id}/resend`, { method: "POST" });
      toast.success("Invoice email resent");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not resend");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Invoices"
        description="Official tax invoices issued after payment. Issued numbers never change. Company details for new invoices are configured in Settings."
        actions={
          <Link href={adminPath("/settings")}>
            <Button variant="outline" size="sm">Invoice settings</Button>
          </Link>
        }
      />
      <form
        className="flex gap-2 mb-4 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <Input
          placeholder="Search invoice no., booking ID, customer"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No invoices yet.</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{inv.invoice_type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{inv.booking_number || String(inv.booking_id || "").slice(0, 8)}</TableCell>
                  <TableCell>
                    <div>{inv.customer_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{inv.customer_email}</div>
                  </TableCell>
                  <TableCell>{rupees(inv.total_paise)}</TableCell>
                  <TableCell>{inv.payment_status || "PAID"}</TableCell>
                  <TableCell>{inv.email_status || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDisplayDateTime(inv.created_at)}</TableCell>
                  <TableCell className="space-x-2 whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => void openHtml(inv.id)}>
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void downloadInvoicePdf(inv.id).catch((e) => toast.error(e.message))}
                    >
                      PDF
                    </Button>
                    {inv.invoice_type === "customer" && (
                      <Button size="sm" disabled={busy === inv.id} onClick={() => void resend(inv.id)}>
                        {busy === inv.id ? "Sending…" : "Resend"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminLayout>
  );
}
