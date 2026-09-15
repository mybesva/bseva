/** Shared pujari booking list helpers */

export type PujariBookingRow = {
  booking: {
    id: string;
    bookingNumber: string;
    bookingDate: Date | string | null;
    bookingTime: string | null;
    location: string;
    city: string | null;
    status: string;
    tier: string;
    mode?: string | null;
    meetingUrl?: string | null;
    publicInviteUrl?: string | null;
    totalAmount: number;
    priestAmount: number;
    platformFee: number;
    basePrice: number;
    gstAmount: number;
    specialInstructions: string | null;
    customerName: string | null;
    serviceName: string;
    samagriRequested?: boolean;
    offerInvited?: boolean;
    offerDistanceKm?: number | null;
  };
  pujaType: { name: string; estimatedDuration: number };
  customer: { name: string | null; email: string | null; phone: string | null };
};

const TERMINAL = new Set(["completed", "cancelled", "refunded"]);

export function mapApiBooking(b: any): PujariBookingRow {
  const base = Number(b.base_price_paise || 0);
  const platform = Number(b.platform_fee_paise || Math.round(base * 0.15));
  const priestAmount = Number(b.pujari_payable_paise || base - platform);
  return {
    booking: {
      id: String(b.id),
      bookingNumber: b.booking_number,
      bookingDate: b.booking_date,
      bookingTime: b.start_time,
      location: b.location_label,
      city: b.location_label,
      status: b.status,
      tier: b.package_type,
      mode: b.mode || null,
      meetingUrl: b.meeting_url || null,
      publicInviteUrl: b.public_invite_url || null,
      totalAmount: b.total_paise,
      priestAmount,
      platformFee: platform,
      basePrice: base,
      gstAmount: Number(b.gst_amount_paise || 0),
      specialInstructions: null,
      customerName: b.customer_name,
      serviceName: b.service_name,
      samagriRequested: Boolean(b.samagri_requested),
      offerInvited: Boolean(b.pujari_offer_invited),
      offerDistanceKm:
        b.offer_distance_km != null ? Number(b.offer_distance_km) : null,
    },
    pujaType: { name: b.service_name, estimatedDuration: 90 },
    customer: { name: b.customer_name, email: null, phone: null },
  };
}

/** Scheduled start (local). Uses booking date + start_time when available. */
export function bookingStartAt(row: PujariBookingRow): Date | null {
  if (!row.booking.bookingDate) return null;
  const d = new Date(row.booking.bookingDate);
  if (Number.isNaN(d.getTime())) return null;
  const t = (row.booking.bookingTime || "").trim();
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    d.setHours(Number(m[1]), Number(m[2]), Number(m[3] || 0), 0);
  } else {
    // Date-only: treat as end of that local day so the day stays "active"
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

export function isTerminalStatus(status: string) {
  return TERMINAL.has(status);
}

/** Past scheduled time but not completed/cancelled — show under Completed. */
export function isExpiredBooking(row: PujariBookingRow, now = new Date()) {
  if (isTerminalStatus(row.booking.status)) return false;
  const start = bookingStartAt(row);
  if (!start) return false;
  return start.getTime() < now.getTime();
}

export function isUpcomingBooking(row: PujariBookingRow, now = new Date()) {
  if (isTerminalStatus(row.booking.status)) return false;
  if (isExpiredBooking(row, now)) return false;
  return true;
}

export function isPastBooking(row: PujariBookingRow, now = new Date()) {
  return isTerminalStatus(row.booking.status) || isExpiredBooking(row, now);
}

export function displayStatus(row: PujariBookingRow, now = new Date()) {
  if (isExpiredBooking(row, now) && row.booking.status !== "completed") return "expired";
  return row.booking.status;
}

export function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function statusBadgeClass(status: string) {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-800";
    case "pending":
    case "pending_acceptance":
      return "bg-yellow-100 text-yellow-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "completed":
      return "bg-gray-100 text-gray-800";
    case "cancelled":
    case "expired":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
