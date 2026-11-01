import { displayTokenLabel } from "./displayLabels";

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

export type ReportCell = string | number | null;
export type ReportSheetTable = { name: string; rows: ReportCell[][] };

function rs(paise: number | null | undefined): number {
  return Math.round(Number(paise || 0)) / 100;
}

function pct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return "";
  const n = Number(v);
  return `${n >= 0 ? "+" : ""}${n}%`;
}

function periodLine(p: ReportWorkbookData["period"], formatDate: (iso: string) => string): string {
  return `${p.label} (${formatDate(p.from)} – ${formatDate(p.to)})`;
}

/** Same workbook tabs/cells as web Analytics & Reports Excel export. */
export function buildReportSheetTables(
  report: ReportWorkbookData,
  formatDate: (iso: string) => string
): ReportSheetTable[] {
  const ov = report.overview;
  const p = report.period;
  const period = periodLine(p, formatDate);
  return [
    {
      name: "Dashboard",
      rows: [
        ["BSeva Analytics & Reports"],
        ["Dashboard"],
        ["Period", period],
        [],
        ["KPI", "Value", "vs previous period"],
        ["Total Revenue (₹)", rs(ov.revenue_paise), pct(ov.revenue_change_pct)],
        ["Total Bookings", ov.bookings, pct(ov.bookings_change_pct)],
        ["Completed", ov.completed, ""],
        ["Confirmed", ov.confirmed, ""],
        ["Cancelled", ov.cancelled, ""],
        ["Active Pujaris", ov.active_pujaris, ""],
        ["Pujaris Who Served", ov.serving_pujaris, ""],
        ["Customer Satisfaction (Avg Rating)", ov.avg_rating ?? "—", ""],
        ["Repeat Rate %", ov.repeat_rate, ""],
        ["GMV (₹)", rs(report.payments.gmv), ""],
        ["Platform Fee (₹)", rs(report.payments.commissions), ""],
        ["Pujari Payouts (₹)", rs(report.payments.priest_payouts), ""],
        ["Pending Settlements (₹)", rs(report.payments.pending_settlements), ""],
        ["Refunds (₹)", rs(report.payments.refunds), ""],
        ["Customers (Total)", report.customers.total_customers, ""],
        ["New Customers in Period", report.customers.new_registrations, ""],
        ["Samagri Kit Bookings", report.samagri_bookings, ""],
        [],
        ["Booking Trend"],
        ["Date", "Bookings", "Completed", "Confirmed", "Cancelled"],
        ...ov.trend.map((d) => [formatDate(d.date), d.total, d.completed, d.confirmed, d.cancelled]),
        [],
        ["Payment Methods"],
        ["Method", "Count", "Amount (₹)", "Share %"],
        ...ov.payment_methods.map((m) => [m.method, m.count, rs(m.amount_paise), m.percentage]),
        [],
        ["Top Performing Services"],
        ["Service", "Bookings", "Revenue (₹)", "Avg Duration (Min)"],
        ...ov.top_services.map((s) => [s.name, s.bookings, rs(s.revenue), s.avg_duration]),
      ],
    },
    {
      name: "Overview",
      rows: [
        ["Overview"],
        ["Period", period],
        [],
        ["Metric", "Value", "vs previous period"],
        ["Total Revenue (₹)", rs(ov.revenue_paise), pct(ov.revenue_change_pct)],
        ["Total Bookings", ov.bookings, pct(ov.bookings_change_pct)],
        ["Completed", ov.completed, ""],
        ["Confirmed", ov.confirmed, ""],
        ["Cancelled", ov.cancelled, ""],
        ["Active Pujaris", ov.active_pujaris, ""],
        ["Pujaris Who Served", ov.serving_pujaris, ""],
        ["Avg Rating", ov.avg_rating ?? "—", ""],
        ["Repeat Rate %", ov.repeat_rate, ""],
        [],
        ["Booking Trend"],
        ["Date", "Bookings", "Completed", "Confirmed", "Cancelled"],
        ...ov.trend.map((d) => [formatDate(d.date), d.total, d.completed, d.confirmed, d.cancelled]),
        [],
        ["Payment Methods"],
        ["Method", "Count", "Amount (₹)", "Share %"],
        ...ov.payment_methods.map((m) => [m.method, m.count, rs(m.amount_paise), m.percentage]),
        [],
        ["Top Performing Services"],
        ["Service", "Bookings", "Revenue (₹)", "Avg Duration (Min)"],
        ...ov.top_services.map((s) => [s.name, s.bookings, rs(s.revenue), s.avg_duration]),
      ],
    },
    {
      name: "Pujari",
      rows: [
        ["Pujari Performance"],
        ["Period", period],
        ["Approved Pujaris Who Had Bookings in This Period"],
        [],
        ["Pujari", "Bookings", "Rating", "Earnings (₹)", "Status"],
        ...report.pujaris.map((r) => [
          r.name,
          r.bookings,
          Number(r.rating || 0),
          rs(r.earnings),
          displayTokenLabel(r.availability_status || "available"),
        ]),
      ],
    },
    {
      name: "Customer",
      rows: [
        ["Customer"],
        ["Period", period],
        [],
        ["Metric", "Value"],
        ["Total Customers", report.customers.total_customers],
        ["New in Period", report.customers.new_registrations],
        ["Bookings", report.customers.total_bookings],
        ["Customers Who Booked", report.customers.booked_customers],
        ["Repeat Rate %", report.customers.repeat_rate],
        ["Avg Rating", report.customers.avg_rating ?? "—"],
        [],
        ["Top Customers"],
        ["Customer", "Email", "Bookings", "Spent (₹)"],
        ...report.customers.top.map((c) => [c.name, c.email, c.bookings, rs(c.spent_paise)]),
      ],
    },
    {
      name: "Temple",
      rows: [
        ["Temple / Location"],
        ["Period", period],
        [],
        ["By Service Mode"],
        ["Mode", "Bookings", "Revenue (₹)"],
        ...report.modes.map((m) => [displayTokenLabel(String(m.name || ""), ""), m.bookings, rs(m.revenue)]),
        [],
        ["Locations"],
        ["Location", "Mode", "Bookings", "Revenue (₹)"],
        ...report.temples.map((t) => [t.name, displayTokenLabel(String(t.city || ""), ""), t.bookings, rs(t.revenue)]),
      ],
    },
    {
      name: "Service",
      rows: [
        ["Service / Puja Analytics"],
        ["Period", period],
        [],
        ["Service", "Bookings", "Revenue (₹)", "Avg Duration (Min)"],
        ...report.services.map((s) => [s.name, s.bookings, rs(s.revenue), s.avg_duration]),
      ],
    },
    {
      name: "Samagri",
      rows: [
        ["Samagri Usage"],
        ["Period", period],
        ["Bookings That Included a Samagri Kit", report.samagri_bookings],
        [],
        ["Item", "Unit", "Bookings Used", "Times Listed", "Status"],
        ...report.samagri.map((s) => [s.name, s.unit, s.bookings, s.consumed, displayTokenLabel(s.status, "")]),
      ],
    },
    {
      name: "Payment",
      rows: [
        ["Payment"],
        ["Period", period],
        [],
        ["Metric", "Amount (₹)"],
        ["GMV", rs(report.payments.gmv)],
        ["Platform Fee", rs(report.payments.commissions)],
        ["Pujari Payouts", rs(report.payments.priest_payouts)],
        ["Pending Settlements", rs(report.payments.pending_settlements)],
        ["Refunds", rs(report.payments.refunds)],
        [],
        ["Payment Method Breakdown"],
        ["Method", "Count", "Amount (₹)", "Share %"],
        ...report.payments.by_method.map((m) => [displayTokenLabel(m.method, ""), m.count, rs(m.amount_paise), m.percentage]),
      ],
    },
  ];
}

export function reportWorkbookFilename(report: ReportWorkbookData): string {
  return `BSeva_Reports_${report.period.from}_to_${report.period.to}.xlsx`;
}
