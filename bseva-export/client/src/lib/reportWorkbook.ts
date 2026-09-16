import * as XLSX from "xlsx";
import { formatDisplayDate } from "@/lib/formatDate";

export type ReportWorkbookData = {
  period: { from: string; to: string; label: string; range: string };
  overview: {
    revenue_paise: number;
    revenue_change_pct: number | null;
    bookings: number;
    bookings_change_pct: number | null;
    cancelled: number;
    completed: number;
    confirmed: number;
    active_pujaris: number;
    serving_pujaris: number;
    avg_rating: number | null;
    repeat_rate: number;
    trend: { date: string; total: number; cancelled: number; completed: number; confirmed: number }[];
    payment_methods: { method: string; amount_paise: number; count: number; percentage: number }[];
    top_services: { id: string; name: string; bookings: number; revenue: number; avg_duration: number }[];
  };
  pujaris: { id: string; name: string; bookings: number; rating: number; earnings: number; availability_status: string }[];
  customers: {
    total_customers: number;
    new_registrations: number;
    total_bookings: number;
    booked_customers: number;
    repeat_rate: number;
    avg_rating: number | null;
    top: { id: string; name: string; email: string; bookings: number; spent_paise: number }[];
  };
  temples: { name: string; city: string; bookings: number; revenue: number }[];
  modes: { name: string; bookings: number; revenue: number }[];
  services: { id: string; name: string; bookings: number; revenue: number; avg_duration: number }[];
  samagri: { id: string; name: string; unit: string; consumed: number; bookings: number; status: string }[];
  samagri_bookings: number;
  payments: {
    gmv: number;
    commissions: number;
    priest_payouts: number;
    pending_settlements: number;
    refunds: number;
    by_method: { method: string; amount_paise: number; count: number; percentage: number }[];
  };
};

type Cell = string | number | null;

function rs(paise: number | null | undefined): number {
  return Math.round(Number(paise || 0)) / 100;
}

function pct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return "";
  const n = Number(v);
  return `${n >= 0 ? "+" : ""}${n}%`;
}

function periodLine(p: ReportWorkbookData["period"]): string {
  return `${p.label} (${formatDisplayDate(p.from)} – ${formatDisplayDate(p.to)})`;
}

function sheet(rows: Cell[][], widths: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = widths.map((wch) => ({ wch }));
  return ws;
}

function dashboardSheet(report: ReportWorkbookData): XLSX.WorkSheet {
  const ov = report.overview;
  const p = report.period;
  const rows: Cell[][] = [
    ["BSeva Analytics & Reports"],
    ["Dashboard"],
    ["Period", periodLine(p)],
    [],
    ["KPI", "Value", "vs previous period"],
    ["Total revenue (₹)", rs(ov.revenue_paise), pct(ov.revenue_change_pct)],
    ["Total bookings", ov.bookings, pct(ov.bookings_change_pct)],
    ["Completed", ov.completed, ""],
    ["Confirmed", ov.confirmed, ""],
    ["Cancelled", ov.cancelled, ""],
    ["Active pujaris", ov.active_pujaris, ""],
    ["Pujaris who served", ov.serving_pujaris, ""],
    ["Customer satisfaction (avg rating)", ov.avg_rating ?? "—", ""],
    ["Repeat rate %", ov.repeat_rate, ""],
    ["GMV (₹)", rs(report.payments.gmv), ""],
    ["Platform fee (₹)", rs(report.payments.commissions), ""],
    ["Pujari payouts (₹)", rs(report.payments.priest_payouts), ""],
    ["Pending settlements (₹)", rs(report.payments.pending_settlements), ""],
    ["Refunds (₹)", rs(report.payments.refunds), ""],
    ["Customers (total)", report.customers.total_customers, ""],
    ["New customers in period", report.customers.new_registrations, ""],
    ["Samagri kit bookings", report.samagri_bookings, ""],
    [],
    ["Booking trend"],
    ["Date", "Bookings", "Completed", "Confirmed", "Cancelled"],
    ...ov.trend.map((d) => [
      formatDisplayDate(d.date),
      d.total,
      d.completed,
      d.confirmed,
      d.cancelled,
    ]),
    [],
    ["Payment methods"],
    ["Method", "Count", "Amount (₹)", "Share %"],
    ...ov.payment_methods.map((m) => [m.method, m.count, rs(m.amount_paise), m.percentage]),
    [],
    ["Top performing services"],
    ["Service", "Bookings", "Revenue (₹)", "Avg duration (min)"],
    ...ov.top_services.map((s) => [s.name, s.bookings, rs(s.revenue), s.avg_duration]),
  ];
  return sheet(rows, [36, 22, 22, 18, 16]);
}

function overviewSheet(report: ReportWorkbookData): XLSX.WorkSheet {
  const ov = report.overview;
  const rows: Cell[][] = [
    ["Overview"],
    ["Period", periodLine(report.period)],
    [],
    ["Metric", "Value", "vs previous period"],
    ["Total revenue (₹)", rs(ov.revenue_paise), pct(ov.revenue_change_pct)],
    ["Total bookings", ov.bookings, pct(ov.bookings_change_pct)],
    ["Completed", ov.completed, ""],
    ["Confirmed", ov.confirmed, ""],
    ["Cancelled", ov.cancelled, ""],
    ["Active pujaris", ov.active_pujaris, ""],
    ["Pujaris who served", ov.serving_pujaris, ""],
    ["Avg rating", ov.avg_rating ?? "—", ""],
    ["Repeat rate %", ov.repeat_rate, ""],
    [],
    ["Booking trend"],
    ["Date", "Bookings", "Completed", "Confirmed", "Cancelled"],
    ...ov.trend.map((d) => [
      formatDisplayDate(d.date),
      d.total,
      d.completed,
      d.confirmed,
      d.cancelled,
    ]),
    [],
    ["Payment methods"],
    ["Method", "Count", "Amount (₹)", "Share %"],
    ...ov.payment_methods.map((m) => [m.method, m.count, rs(m.amount_paise), m.percentage]),
    [],
    ["Top performing services"],
    ["Service", "Bookings", "Revenue (₹)", "Avg duration (min)"],
    ...ov.top_services.map((s) => [s.name, s.bookings, rs(s.revenue), s.avg_duration]),
  ];
  return sheet(rows, [36, 18, 18, 16, 14]);
}

export function downloadReportWorkbook(report: ReportWorkbookData) {
  const p = report.period;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dashboardSheet(report), "Dashboard");
  XLSX.utils.book_append_sheet(wb, overviewSheet(report), "Overview");

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Pujari performance"],
        ["Period", periodLine(p)],
        ["Approved pujaris who had bookings in this period"],
        [],
        ["Pujari", "Bookings", "Rating", "Earnings (₹)", "Status"],
        ...report.pujaris.map((r) => [
          r.name,
          r.bookings,
          Number(r.rating || 0),
          rs(r.earnings),
          r.availability_status || "available",
        ]),
      ],
      [28, 12, 12, 16, 16],
    ),
    "Pujari",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Customer"],
        ["Period", periodLine(p)],
        [],
        ["Metric", "Value"],
        ["Total customers", report.customers.total_customers],
        ["New in period", report.customers.new_registrations],
        ["Bookings", report.customers.total_bookings],
        ["Customers who booked", report.customers.booked_customers],
        ["Repeat rate %", report.customers.repeat_rate],
        ["Avg rating", report.customers.avg_rating ?? "—"],
        [],
        ["Top customers"],
        ["Customer", "Email", "Bookings", "Spent (₹)"],
        ...report.customers.top.map((c) => [c.name, c.email, c.bookings, rs(c.spent_paise)]),
      ],
      [28, 32, 12, 16],
    ),
    "Customer",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Temple / location"],
        ["Period", periodLine(p)],
        [],
        ["By service mode"],
        ["Mode", "Bookings", "Revenue (₹)"],
        ...report.modes.map((m) => [String(m.name || "").replace(/_/g, " "), m.bookings, rs(m.revenue)]),
        [],
        ["Locations"],
        ["Location", "Mode", "Bookings", "Revenue (₹)"],
        ...report.temples.map((t) => [t.name, String(t.city || "").replace(/_/g, " "), t.bookings, rs(t.revenue)]),
      ],
      [28, 18, 12, 16],
    ),
    "Temple",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Service / puja analytics"],
        ["Period", periodLine(p)],
        [],
        ["Service", "Bookings", "Revenue (₹)", "Avg duration (min)"],
        ...report.services.map((s) => [s.name, s.bookings, rs(s.revenue), s.avg_duration]),
      ],
      [36, 12, 16, 20],
    ),
    "Service",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Samagri usage"],
        ["Period", periodLine(p)],
        ["Bookings that included a samagri kit", report.samagri_bookings],
        [],
        ["Item", "Unit", "Bookings used", "Times listed", "Status"],
        ...report.samagri.map((s) => [s.name, s.unit, s.bookings, s.consumed, s.status]),
      ],
      [32, 12, 16, 14, 14],
    ),
    "Samagri",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Payment"],
        ["Period", periodLine(p)],
        [],
        ["Metric", "Amount (₹)"],
        ["GMV", rs(report.payments.gmv)],
        ["Platform fee", rs(report.payments.commissions)],
        ["Pujari payouts", rs(report.payments.priest_payouts)],
        ["Pending settlements", rs(report.payments.pending_settlements)],
        ["Refunds", rs(report.payments.refunds)],
        [],
        ["Payment method breakdown"],
        ["Method", "Count", "Amount (₹)", "Share %"],
        ...report.payments.by_method.map((m) => [m.method, m.count, rs(m.amount_paise), m.percentage]),
      ],
      [28, 14, 16, 12],
    ),
    "Payment",
  );

  const filename = `BSeva_Reports_${p.from}_to_${p.to}.xlsx`;
  XLSX.writeFile(wb, filename);
}
