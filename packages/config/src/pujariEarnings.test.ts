import { describe, expect, it } from "vitest";
import { pujariEarningsStats, priestShare } from "./pujariEarnings";

describe("pujariEarnings", () => {
  it("prefers pujari_payable_paise", () => {
    expect(priestShare({ pujari_payable_paise: 900, base_price_paise: 1000, platform_fee_paise: 50 })).toBe(900);
  });

  it("computes this-month, completed, pending, and settlement buckets", () => {
    const stats = pujariEarningsStats(
      [
        { status: "completed", booking_date: "2026-09-10", pujari_payable_paise: 1000 },
        { status: "confirmed", booking_date: "2026-09-22", pujari_payable_paise: 400 },
        { status: "in_progress", booking_date: "2026-08-01", pujari_payable_paise: 200 },
      ],
      [
        { status: "paid", amount_paise: 300 },
        { status: "pending", settlement_amount_paise: 150 },
      ],
      new Date("2026-09-20T12:00:00")
    );
    expect(stats.thisMonth).toBe(1400);
    expect(stats.completed).toBe(1000);
    expect(stats.pending).toBe(600);
    expect(stats.settled).toBe(300);
    expect(stats.settlementPending).toBe(150);
  });
});
