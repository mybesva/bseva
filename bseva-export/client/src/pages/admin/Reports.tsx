import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  Users,
  UserCog,
  Church,
  Sparkles,
  Package,
  Calendar,
  CreditCard,
  Download,
  FileBarChart,
  ArrowUpRight,
  ArrowDownRight,
  IndianRupee,
  Star,
  Clock,
  MapPin,
  Loader2,
} from "lucide-react";
import { api, rupees } from "@/lib/api";
import { formatDisplayDate } from "@/lib/formatDate";
import { downloadReportWorkbook, type ReportWorkbookData as Report } from "@/lib/reportWorkbook";
import { toast } from "sonner";

type RangeKey = "today" | "last_7_days" | "last_30_days" | "last_90_days" | "this_year" | "custom";

function Change({ value }: { value: number | null | undefined }) {
  if (value == null || Number.isNaN(value)) return null;
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={`flex items-center mt-1 text-sm ${up ? "text-green-600" : "text-red-600"}`}>
      <Icon className="w-4 h-4" />
      <span>
        {up ? "+" : ""}
        {value}% vs previous period
      </span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-8 text-center">{text}</p>;
}

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function Reports() {
  const [range, setRange] = useState<RangeKey>("last_30_days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const generate = useCallback(
    async (opts?: { range?: RangeKey; from?: string; to?: string }) => {
      const r = opts?.range ?? range;
      const from = opts?.from ?? customFrom;
      const to = opts?.to ?? customTo;
      if (r === "custom" && (!from || !to)) {
        toast.error("Choose a from and to date");
        return;
      }
      setLoading(true);
      try {
        const qs = new URLSearchParams({ range: r });
        if (r === "custom") {
          qs.set("from", from);
          qs.set("to", to);
        }
        const data = await api<Report>(`/admin/reports?${qs.toString()}`);
        setReport(data);
      } catch (e: any) {
        toast.error(e.message || "Could not generate report");
      } finally {
        setLoading(false);
      }
    },
    [range, customFrom, customTo]
  );

  useEffect(() => {
    if (range === "custom") return;
    void generate({ range });
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  function exportWorkbook() {
    if (!report) {
      toast.error("Generate a report first");
      return;
    }
    downloadReportWorkbook(report);
    toast.success("Excel report downloaded (Dashboard + every tab)");
  }

  const ov = report?.overview;
  const maxTrend = Math.max(1, ...(ov?.trend || []).map((d) => Number(d.total || 0)));
  const statusColor: Record<string, string> = {
    available: "bg-green-100 text-green-700",
    busy: "bg-yellow-100 text-yellow-700",
    unavailable: "bg-red-100 text-red-700",
    OK: "bg-green-100 text-green-700",
    Inactive: "bg-gray-100 text-gray-700",
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground">
              {report
                ? `${report.period.label} (${formatDisplayDate(report.period.from)} – ${formatDisplayDate(report.period.to)})`
                : "Live figures from bookings, payments, and settlements."}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Period</Label>
              <Select
                value={range}
                onValueChange={(v) => {
                  const next = v as RangeKey;
                  if (next === "custom" && (!customFrom || !customTo)) {
                    const to = new Date();
                    const from = new Date();
                    from.setDate(from.getDate() - 29);
                    setCustomFrom(isoDate(from));
                    setCustomTo(isoDate(to));
                  }
                  setRange(next);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                  <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                  <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                  <SelectItem value="custom">Custom dates</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {range === "custom" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" />
                </div>
              </>
            )}
            <Button onClick={() => void generate()} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileBarChart className="w-4 h-4 mr-2" />}
              Generate report
            </Button>
            <Button variant="outline" onClick={exportWorkbook} disabled={!report || loading}>
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">{loading && !report ? "…" : rupees(ov?.revenue_paise || 0)}</p>
                  <Change value={ov?.revenue_change_pct} />
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <IndianRupee className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  <p className="text-2xl font-bold">{loading && !report ? "…" : ov?.bookings ?? 0}</p>
                  <Change value={ov?.bookings_change_pct} />
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Pujaris</p>
                  <p className="text-2xl font-bold">{loading && !report ? "…" : ov?.active_pujaris ?? 0}</p>
                  <p className="text-sm text-muted-foreground mt-1">{ov?.serving_pujaris ?? 0} served in this period</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <UserCog className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Customer Satisfaction</p>
                  <p className="text-2xl font-bold">
                    {loading && !report ? "…" : ov?.avg_rating != null ? `${ov.avg_rating}★` : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Repeat rate {ov?.repeat_rate ?? 0}%</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Star className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-7 w-full max-w-4xl">
            <TabsTrigger value="overview" className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="pujari" className="flex items-center gap-1">
              <UserCog className="w-4 h-4" />
              <span className="hidden sm:inline">Pujari</span>
            </TabsTrigger>
            <TabsTrigger value="customer" className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Customer</span>
            </TabsTrigger>
            <TabsTrigger value="temple" className="flex items-center gap-1">
              <Church className="w-4 h-4" />
              <span className="hidden sm:inline">Temple</span>
            </TabsTrigger>
            <TabsTrigger value="service" className="flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Service</span>
            </TabsTrigger>
            <TabsTrigger value="samagri" className="flex items-center gap-1">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Samagri</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-1">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Payment</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Booking trend</CardTitle>
                  <CardDescription>Bookings created in the selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading && !report ? (
                    <div className="flex justify-center h-48 items-center">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : !ov?.trend.length ? (
                    <Empty text="No bookings in this period." />
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {ov.trend.map((day) => (
                        <div key={day.date} className="flex items-center gap-4">
                          <span className="w-24 text-sm text-muted-foreground">{formatDisplayDate(day.date)}</span>
                          <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full flex items-center justify-end pr-2 min-w-[1.5rem]"
                              style={{ width: `${Math.max(8, (Number(day.total) / maxTrend) * 100)}%` }}
                            >
                              <span className="text-xs text-white font-medium">{day.total}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Payment methods</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading && !report ? (
                    <div className="flex justify-center h-48 items-center">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : !ov?.payment_methods.length ? (
                    <Empty text="No payments in this period." />
                  ) : (
                    <div className="space-y-4">
                      {ov.payment_methods.map((method) => (
                        <div key={method.method} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{method.method}</span>
                            <span className="text-muted-foreground">
                              {rupees(method.amount_paise)} ({method.percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div className="h-full bg-sidebar rounded-full" style={{ width: `${method.percentage}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top performing services</CardTitle>
              </CardHeader>
              <CardContent>
                {!ov?.top_services.length ? (
                  <Empty text="No service bookings in this period." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead className="text-center">Bookings</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-center">Avg duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ov.top_services.map((service) => (
                        <TableRow key={service.id}>
                          <TableCell className="font-medium">{service.name}</TableCell>
                          <TableCell className="text-center tabular-nums">{service.bookings}</TableCell>
                          <TableCell className="text-right">{rupees(service.revenue)}</TableCell>
                          <TableCell className="text-center tabular-nums">{service.avg_duration} min</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pujari" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pujari performance</CardTitle>
                <CardDescription>Approved pujaris who had bookings in this period</CardDescription>
              </CardHeader>
              <CardContent>
                {!report?.pujaris.length ? (
                  <Empty text="No pujari bookings in this period." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pujari</TableHead>
                        <TableHead className="text-right">Bookings</TableHead>
                        <TableHead className="text-right">Rating</TableHead>
                        <TableHead className="text-right">Earnings</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.pujaris.map((pujari) => (
                        <TableRow key={pujari.id}>
                          <TableCell className="font-medium">{pujari.name}</TableCell>
                          <TableCell className="text-right">{pujari.bookings}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                              {Number(pujari.rating || 0).toFixed(1)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{rupees(Number(pujari.earnings || 0))}</TableCell>
                          <TableCell>
                            <Badge className={statusColor[pujari.availability_status] || statusColor.available}>
                              {pujari.availability_status || "available"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customer" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Total customers</p>
                  <p className="text-2xl font-bold">{report?.customers.total_customers ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">New in period</p>
                  <p className="text-2xl font-bold">{report?.customers.new_registrations ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Bookings</p>
                  <p className="text-2xl font-bold">{report?.customers.total_bookings ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Repeat rate</p>
                  <p className="text-2xl font-bold">{report?.customers.repeat_rate ?? 0}%</p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top customers</CardTitle>
              </CardHeader>
              <CardContent>
                {!report?.customers.top.length ? (
                  <Empty text="No customer bookings in this period." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Bookings</TableHead>
                        <TableHead className="text-right">Spent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.customers.top.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-muted-foreground">{c.email}</TableCell>
                          <TableCell className="text-right">{c.bookings}</TableCell>
                          <TableCell className="text-right">{rupees(c.spent_paise)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="temple" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">By service mode</CardTitle>
              </CardHeader>
              <CardContent>
                {!report?.modes.length ? (
                  <Empty text="No bookings in this period." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mode</TableHead>
                        <TableHead className="text-right">Bookings</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.modes.map((m) => (
                        <TableRow key={m.name}>
                          <TableCell className="font-medium capitalize">{m.name.replace("_", " ")}</TableCell>
                          <TableCell className="text-right">{m.bookings}</TableCell>
                          <TableCell className="text-right">{rupees(m.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Locations</CardTitle>
                <CardDescription>Grouped from booking addresses in this period</CardDescription>
              </CardHeader>
              <CardContent>
                {!report?.temples.length ? (
                  <Empty text="No location data in this period." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead className="text-right">Bookings</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.temples.map((temple) => (
                        <TableRow key={temple.name}>
                          <TableCell className="font-medium">{temple.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 capitalize">
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                              {String(temple.city || "").replace("_", " ")}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{temple.bookings}</TableCell>
                          <TableCell className="text-right">{rupees(temple.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="service" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Service / puja analytics</CardTitle>
              </CardHeader>
              <CardContent>
                {!report?.services.length ? (
                  <Empty text="No service bookings in this period." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead className="text-center">Bookings</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-center">Avg duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.services.map((service) => (
                        <TableRow key={service.id}>
                          <TableCell className="font-medium">{service.name}</TableCell>
                          <TableCell className="text-center tabular-nums">{service.bookings}</TableCell>
                          <TableCell className="text-right">{rupees(service.revenue)}</TableCell>
                          <TableCell className="text-center tabular-nums">
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              {service.avg_duration} min
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="samagri" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Samagri usage</CardTitle>
                <CardDescription>
                  {report?.samagri_bookings ?? 0} bookings in this period included a samagri kit
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!report?.samagri.length ? (
                  <Empty text="No samagri items on file yet." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Bookings used</TableHead>
                        <TableHead className="text-right">Times listed</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.samagri.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.name} <span className="text-muted-foreground text-xs">({item.unit})</span>
                          </TableCell>
                          <TableCell className="text-right">{item.bookings}</TableCell>
                          <TableCell className="text-right">{item.consumed}</TableCell>
                          <TableCell>
                            <Badge className={statusColor[item.status] || statusColor.OK}>{item.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">GMV</p>
                  <p className="text-xl font-bold">{rupees(report?.payments.gmv || 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Platform fee</p>
                  <p className="text-xl font-bold text-green-600">{rupees(report?.payments.commissions || 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Pujari payouts</p>
                  <p className="text-xl font-bold">{rupees(report?.payments.priest_payouts || 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Pending settle</p>
                  <p className="text-xl font-bold text-yellow-600">{rupees(report?.payments.pending_settlements || 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Refunds</p>
                  <p className="text-xl font-bold text-red-600">{rupees(report?.payments.refunds || 0)}</p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment method breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {!report?.payments.by_method.length ? (
                  <Empty text="No payments in this period." />
                ) : (
                  <div className="space-y-4">
                    {report.payments.by_method.map((method) => (
                      <div key={method.method} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{method.method}</span>
                          <span className="text-muted-foreground">
                            {rupees(method.amount_paise)} ({method.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-3">
                          <div
                            className="h-full bg-gradient-to-r from-sidebar to-primary rounded-full"
                            style={{ width: `${method.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
