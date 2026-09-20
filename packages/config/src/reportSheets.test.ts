import { describe, expect, it } from "vitest";
import { buildReportSheetTables, reportWorkbookFilename, type ReportWorkbookData } from "./reportSheets";

const sample: ReportWorkbookData = {
  period: { from: "2026-09-01", to: "2026-09-20", label: "Custom", range: "custom" },
  overview: {
    revenue_paise: 100000,
    revenue_change_pct: 10,
    bookings: 4,
    bookings_change_pct: -5,
    cancelled: 1,
    completed: 2,
    confirmed: 1,
    active_pujaris: 3,
    serving_pujaris: 2,
    avg_rating: 4.5,
    repeat_rate: 20,
    trend: [{ date: "2026-09-01", total: 1, cancelled: 0, completed: 1, confirmed: 0 }],
    payment_methods: [{ method: "upi", amount_paise: 100000, count: 4, percentage: 100 }],
    top_services: [{ id: "1", name: "Satyanarayan Puja", bookings: 2, revenue: 50000, avg_duration: 90 }],
  },
  pujaris: [{ id: "p", name: "A", bookings: 2, rating: 5, earnings: 80000, availability_status: "available" }],
  customers: {
    total_customers: 10,
    new_registrations: 2,
    total_bookings: 4,
    booked_customers: 3,
    repeat_rate: 20,
    avg_rating: 4.5,
    top: [{ id: "c", name: "B", email: "b@x.com", bookings: 2, spent_paise: 50000 }],
  },
  temples: [{ name: "Home", city: "in_person", bookings: 3, revenue: 80000 }],
  modes: [{ name: "in_person", bookings: 3, revenue: 80000 }],
  services: [{ id: "1", name: "Satyanarayan Puja", bookings: 2, revenue: 50000, avg_duration: 90 }],
  samagri: [{ id: "s", name: "Kit", unit: "kit", consumed: 2, bookings: 2, status: "ok" }],
  samagri_bookings: 2,
  payments: {
    gmv: 100000,
    commissions: 15000,
    priest_payouts: 85000,
    pending_settlements: 0,
    refunds: 0,
    by_method: [{ method: "upi", amount_paise: 100000, count: 4, percentage: 100 }],
  },
};

describe("reportSheets", () => {
  it("emits the same workbook tabs as web Excel export", () => {
    const sheets = buildReportSheetTables(sample, (d) => d.slice(0, 10));
    expect(sheets.map((s) => s.name)).toEqual([
      "Dashboard",
      "Overview",
      "Pujari",
      "Customer",
      "Temple",
      "Service",
      "Samagri",
      "Payment",
    ]);
    expect(reportWorkbookFilename(sample)).toBe("BSeva_Reports_2026-09-01_to_2026-09-20.xlsx");
    expect(sheets[0].rows.some((r) => r[0] === "Total revenue (₹)")).toBe(true);
  });
});
