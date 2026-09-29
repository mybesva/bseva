/**
 * Human-readable labels for English enum tokens shown in the UI.
 * Call this only on raw keys (status, service type, mode). Do not pass
 * already-translated sentences — other languages must keep their own casing.
 */

const ACRONYMS = new Set(["UPI", "OTP", "ID", "PDF", "GST", "QR", "SMS", "OK", "API", "URL", "IST"]);

const LABELS: Record<string, string> = {
  all: "All",
  puja: "Puja",
  chadhava: "Chadhava",
  pravachan: "Pravachan",
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  rejected: "Rejected",
  approved: "Approved",
  active: "Active",
  blocked: "Blocked",
  failed: "Failed",
  paid: "Paid",
  unpaid: "Unpaid",
  refunded: "Refunded",
  free: "Free",
  draft: "Draft",
  published: "Published",
  offline: "Offline",
  online: "Online",
  hybrid: "Hybrid",
  virtual: "Virtual",
  physical: "In Person",
  in_person: "In Person",
  group_live: "Group Live",
  proxy: "Proxy",
  upcoming: "Upcoming",
  expired: "Expired",
  live: "Live",
  open: "Open",
  closed: "Closed",
  resolved: "Resolved",
  escalated: "Escalated",
  requested: "Requested",
  guided: "Guided",
  eligible: "Eligible",
  settled: "Settled",
  awaiting: "Awaiting",
  available: "Available",
  unavailable: "Unavailable",
  busy: "Busy",
  sent: "Sent",
  queued: "Queued",
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
  customer: "Customer",
  pujari: "Pujari",
  temple: "Temple",
  admin: "Admin",
  system: "System",
  guest: "Guest",
  other: "Other",
  settlement: "Settlement",
  pending_acceptance: "Pending Acceptance",
  in_progress: "In Progress",
  needs_reassignment: "Needs Reassignment",
  correction_required: "Correction Required",
  under_review: "Under Review",
  refund_requested: "Refund Requested",
  refund_pending: "Refund Pending",
  not_required: "Not Required",
  waiting_for_user: "Waiting for User",
  super_admin: "Super Admin",
  head_pujari: "Head Pujari",
  pujari_loyalty: "Pujari Loyalty",
  customer_referral: "Customer Referral",
  pujari_referral: "Pujari Referral",
  identity: "Aadhaar",
  driving_licence: "Driving Licence",
  certificate: "Certificate",
  supporting: "Supporting",
  whatsapp: "WhatsApp",
  upi: "UPI",
  otp: "OTP",
  gst: "GST",
  pdf: "PDF",
  qr: "QR",
  sms: "SMS",
  id: "ID",
  ok: "OK",
};

export function displayTokenLabel(value: string | null | undefined, empty = "—"): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "—") return raw || empty;
  if (/[^\u0000-\u024f]/.test(raw)) return raw;
  const key = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if (LABELS[key]) return LABELS[key];
  if (/[A-Z]/.test(raw) && !raw.includes("_")) return raw;
  const words = key.split("_").filter(Boolean);
  if (!words.length) return raw;
  return words
    .map((word, index) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      if (index > 0 && (word === "for" || word === "of" || word === "and" || word === "or")) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/** Prefer a real translation. Fall back to an English token label when the key is missing. */
export function translatedTokenLabel(
  translated: string,
  lookupKey: string,
  raw: string | null | undefined,
  empty = "—",
): string {
  if (translated && translated !== lookupKey) return translated;
  return displayTokenLabel(raw, empty);
}
