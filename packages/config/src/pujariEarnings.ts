export function priestShare(b: {
  pujari_payable_paise?: number | null;
  base_price_paise?: number | null;
  platform_fee_paise?: number | null;
}): number {
  if (b.pujari_payable_paise != null) return Number(b.pujari_payable_paise);
  return Math.max(0, Number(b.base_price_paise || 0) - Number(b.platform_fee_paise || 0));
}

export function settlementAmountPaise(s: {
  settlement_amount_paise?: number | null;
  amount_paise?: number | null;
  pujari_amount_paise?: number | null;
}): number {
  return Number(s.settlement_amount_paise || s.amount_paise || s.pujari_amount_paise || 0);
}

function isSameCalendarMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function pujariEarningsStats(
  bookings: Array<{
    status?: string;
    booking_date?: string | null;
    pujari_payable_paise?: number | null;
    base_price_paise?: number | null;
    platform_fee_paise?: number | null;
  }>,
  settlements: Array<{
    status?: string;
    settlement_amount_paise?: number | null;
    amount_paise?: number | null;
    pujari_amount_paise?: number | null;
  }>,
  now = new Date()
) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let thisMonth = 0;
  let completed = 0;
  let pending = 0;
  const rows: typeof bookings = [];
  for (const b of bookings) {
    const status = String(b.status || "");
    const share = priestShare(b);
    const d = b.booking_date ? new Date(String(b.booking_date).slice(0, 10)) : null;
    if (["completed", "confirmed", "in_progress"].includes(status)) {
      if (d && !Number.isNaN(d.getTime()) && isSameCalendarMonth(d, monthStart)) thisMonth += share;
    }
    if (status === "completed") {
      completed += share;
      rows.push(b);
    } else if (status === "confirmed" || status === "in_progress") {
      pending += share;
    }
  }
  const settled = settlements
    .filter((s) => s.status === "paid" || s.status === "settled")
    .reduce((sum, s) => sum + settlementAmountPaise(s), 0);
  const settlementPending = settlements
    .filter((s) => s.status === "pending" || s.status === "held" || s.status === "eligible")
    .reduce((sum, s) => sum + settlementAmountPaise(s), 0);
  return { thisMonth, completed, pending, settled, settlementPending, rows: rows.slice(0, 40) };
}
