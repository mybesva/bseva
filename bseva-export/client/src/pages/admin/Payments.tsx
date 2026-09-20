import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import { PujaTitle } from "@/components/PujaTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatDisplayDate, lastNDaysRange } from "@/lib/formatDate";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IndianRupee, TrendingUp, CreditCard, Wallet } from "lucide-react";
import { apiBookings, rupees } from "@/lib/api";
import { adminPath } from "@/const";
import { toast } from "sonner";
import {
  AdminPager,
  BOOKING_PAGE_SIZES,
  DEFAULT_BOOKING_PAGE_SIZE,
  parsePage,
  parsePageSize,
} from "@/components/AdminPager";

const TH = "sticky top-0 z-20 bg-card border-b";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-purple-100 text-purple-800",
  refund_pending: "bg-purple-100 text-purple-800",
  refund_requested: "bg-purple-100 text-purple-800",
};

export default function Payments() {
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [paidTotal, setPaidTotal] = useState(0);
  const [platformFees, setPlatformFees] = useState(0);
  const [pujariPayouts, setPujariPayouts] = useState(0);
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const statusFilter = params.get("status") || "all";
  const rangeFilter = params.get("range") || "all";
  const dateFrom = params.get("from") || "";
  const dateTo = params.get("to") || "";
  const pageSize = parsePageSize(params.get("size"), BOOKING_PAGE_SIZES, DEFAULT_BOOKING_PAGE_SIZE);
  const urlPage = parsePage(params.get("page"));
  const [q, setQ] = useState(params.get("q") || "");

  function updateFilters(next: {
    status?: string;
    range?: string;
    from?: string;
    to?: string;
    q?: string;
    page?: number;
    size?: number;
  }) {
    const sp = new URLSearchParams();
    const st = next.status ?? statusFilter;
    const range = next.range ?? rangeFilter;
    const from = next.from ?? dateFrom;
    const to = next.to ?? dateTo;
    const query = next.q !== undefined ? next.q : params.get("q") || "";
    const size = next.size ?? pageSize;
    const resetPage =
      next.status !== undefined ||
      next.range !== undefined ||
      next.from !== undefined ||
      next.to !== undefined ||
      next.q !== undefined ||
      next.size !== undefined;
    const p = next.page ?? (resetPage ? 1 : urlPage);
    if (st && st !== "all") sp.set("status", st);
    if (range && range !== "all") sp.set("range", range);
    if (range === "custom") {
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
    }
    if (query.trim()) sp.set("q", query.trim());
    if (size !== DEFAULT_BOOKING_PAGE_SIZE) sp.set("size", String(size));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    setLocation(adminPath(`/payments${qs ? `?${qs}` : ""}`));
  }

  async function load(p = urlPage) {
    const extra: Record<string, string> = { stats: "true" };
    if (statusFilter && statusFilter !== "all") extra.payment_status = statusFilter;
    const qParam = (params.get("q") || "").trim();
    if (qParam) extra.q = qParam;
    if (rangeFilter === "last_30") {
      const { from, to } = lastNDaysRange(30);
      extra.date_from = from;
      extra.date_to = to;
    } else if (rangeFilter === "custom") {
      if (dateFrom) extra.date_from = dateFrom;
      if (dateTo) extra.date_to = dateTo;
    }
    try {
      const res = await apiBookings(p, pageSize, extra);
      setRows(res.items || []);
      setTotal(res.total || 0);
      setPage(res.page || p);
      setPages(res.pages || 1);
      const stats = (res as any).payment_stats || {};
      setPaidTotal(Number(stats.paid_total_paise || 0));
      setPlatformFees(Number(stats.platform_fee_paise || 0));
      setPujariPayouts(Number(stats.pujari_payable_paise || 0));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  useEffect(() => {
    setQ(params.get("q") || "");
    void load(urlPage);
  }, [search]);

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-sm text-muted-foreground">Live booking payments from the database</p>
        </div>
        <AdminPager
          page={page}
          pages={pages}
          total={total}
          pageSize={pageSize}
          sizes={BOOKING_PAGE_SIZES}
          sizeLabel="per page"
          onPage={(p) => updateFilters({ page: p })}
          onPageSize={(size) => updateFilters({ size })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <IndianRupee size={16} /> Paid revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-price">{rupees(paidTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp size={16} /> Platform fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{rupees(platformFees)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet size={16} /> Pujari payouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{rupees(pujariPayouts)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard size={16} /> Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{total}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Payment status</Label>
          <Select value={statusFilter} onValueChange={(v) => updateFilters({ status: v })}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refund_requested">Refund requested</SelectItem>
              <SelectItem value="refund_pending">Refund pending</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Customer date</Label>
          <Select
            value={rangeFilter}
            onValueChange={(v) =>
              updateFilters({ range: v, from: v === "custom" ? dateFrom : "", to: v === "custom" ? dateTo : "" })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dates</SelectItem>
              <SelectItem value="last_30">Last 30 days</SelectItem>
              <SelectItem value="custom">Between dates</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {rangeFilter === "custom" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-9 w-[150px]" value={dateFrom} onChange={(e) => updateFilters({ from: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-9 w-[150px]" value={dateTo} onChange={(e) => updateFilters({ to: e.target.value })} />
            </div>
          </>
        )}
        <div className="flex gap-2 flex-1 min-w-[220px] items-end">
          <Input
            placeholder="Search number, customer, pujari, service"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateFilters({ q });
            }}
          />
          <Button type="button" variant="secondary" onClick={() => updateFilters({ q })}>
            Search
          </Button>
          {(params.get("q") || statusFilter !== "all" || rangeFilter !== "all") && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQ("");
                setLocation(adminPath("/payments"));
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <Table
        className="border-separate border-spacing-0"
        containerClassName="max-h-[calc(100vh-20rem)] overflow-auto rounded-lg border bg-card"
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={TH}>Booking</TableHead>
            <TableHead className={TH}>Customer</TableHead>
            <TableHead className={TH}>Service</TableHead>
            <TableHead className={TH}>Amount</TableHead>
            <TableHead className={TH}>Platform fee</TableHead>
            <TableHead className={TH}>Pujari payout</TableHead>
            <TableHead className={TH}>Date</TableHead>
            <TableHead className={TH}>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => {
            const pay = String(b.payment_status || "pending").toLowerCase();
            return (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.booking_number}</TableCell>
                <TableCell>{b.customer_name || "—"}</TableCell>
                <TableCell>{b.service_name ? <PujaTitle name={b.service_name} as="span" /> : "—"}</TableCell>
                <TableCell className="font-medium">{rupees(b.total_paise)}</TableCell>
                <TableCell className="text-green-600">{rupees(b.platform_fee_paise)}</TableCell>
                <TableCell className="text-blue-600">{rupees(b.pujari_payable_paise)}</TableCell>
                <TableCell>
                  {formatDisplayDate(b.booking_date)} {b.start_time || ""}
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[pay] || "bg-muted text-foreground"}>
                    {pay.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                No payments match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </AdminLayout>
  );
}
