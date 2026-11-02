/**
 * Account deletion, password reset and reports: shapes and calls from
 * docs/compliance/api-contract.md. Money is in paise.
 */
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

export const DELETION_REASONS: { key: string; label: string }[] = [
  { key: "no_longer_using", label: "I no longer use B-Seva" },
  { key: "not_satisfied", label: "I am not satisfied with the service" },
  { key: "privacy", label: "Privacy concerns" },
  { key: "payment_settlement", label: "Payment or settlement issues" },
  { key: "app_issues", label: "Problems with the app or website" },
  { key: "duplicate_account", label: "I have a duplicate account" },
  { key: "other", label: "Other" },
];

export const EXPLANATION_MIN = 10;
export const EXPLANATION_MAX = 500;

/** Fixed confirmation text from the contract (shown after confirm). */
export const DEACTIVATION_MESSAGE =
  "Your account has been deactivated. Your account deletion request will be completed within 14 days, subject to any legally required retention or unresolved obligations. You will receive confirmation by email.";

export type DeletionState = "requested" | "pending_resolution" | "ready" | "deleted" | "cancelled" | "escalated";

export type DeletionRequest = {
  id: string;
  state: DeletionState;
  reason: string;
  explanation: string;
  requested_at: string;
  deadline_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
  message: string;
};

export type DeletionBooking = {
  id: string;
  booking_number: string;
  service_name: string;
  booking_date: string;
  start_time: string;
  status: string;
  kind: "upcoming" | "ongoing";
  cancellation?: { allowed: boolean; refund_paise: number; fee_paise: number; policy_note: string };
  action?: "reassign";
};

export type DeletionObligations = {
  bookings: DeletionBooking[];
  wallet_balance_paise: number;
  pending_refunds: number;
  pending_settlement_paise: number;
  blocking: string[];
};

export type DeletionOverview = {
  account: { role: "customer" | "pujari" | "head_pujari"; email: string; name: string };
  request: DeletionRequest | null;
  reasons: { key: string; label: string }[];
  obligations: DeletionObligations;
  retention_notice: string;
};

/** A request that is still running (the account is deactivated and can be cancelled). */
export function isOpenDeletion(r: DeletionRequest | null | undefined): r is DeletionRequest {
  return Boolean(r && ["requested", "pending_resolution", "ready", "escalated"].includes(r.state));
}

export const DELETION_STATE_LABELS: Record<string, string> = {
  requested: "Requested",
  pending_resolution: "Pending resolution",
  ready: "Ready for deletion",
  deleted: "Deleted",
  cancelled: "Cancelled",
  escalated: "Escalated",
};

export function deletionStateClass(state: string) {
  switch (state) {
    case "requested":
      return "bg-blue-50 text-blue-900 border-blue-200";
    case "pending_resolution":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "ready":
      return "bg-emerald-50 text-emerald-900 border-emerald-200";
    case "deleted":
      return "bg-slate-100 text-slate-800 border-slate-200";
    case "cancelled":
      return "bg-secondary text-secondary-foreground";
    case "escalated":
      return "bg-red-50 text-red-900 border-red-200";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

/** Label for a reason key, preferring the server's list when it sends one. */
export function reasonLabel(key: string, list: { key: string; label: string }[] = DELETION_REASONS) {
  return list.find((r) => r.key === key)?.label || DELETION_REASONS.find((r) => r.key === key)?.label || key;
}

function bearer(token?: string | null): HeadersInit | undefined {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

/** Pass `token` to use a public-flow deletion token instead of the signed-in session. */
export function getDeletionOverview(token?: string | null) {
  return api<DeletionOverview>("/account/deletion", { headers: bearer(token) });
}

export function requestDeletionOtp(reason: string, explanation: string) {
  return api<{ ok: boolean; message: string; email_hint?: string }>("/account/deletion/request-otp", {
    method: "POST",
    body: JSON.stringify({ reason, explanation }),
  });
}

export function confirmDeletion(
  body: { reason: string; explanation: string; code?: string },
  token?: string | null,
) {
  return api<{ request: DeletionRequest }>("/account/deletion/confirm", {
    method: "POST",
    headers: bearer(token),
    body: JSON.stringify({ ...body, acknowledge: true }),
  });
}

export function publicDeletionRequestOtp(email: string) {
  return api<{ ok: boolean; message: string }>("/account/deletion/public/request-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function publicDeletionVerify(email: string, code: string) {
  return api<{ deletion_token: string; expires_in: number }>("/account/deletion/public/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export function cancelDeletionRequestOtp(email: string) {
  return api<{ ok: boolean; message: string }>("/account/deletion/cancel/request-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function cancelDeletion(email: string, code: string) {
  return api<{ ok: boolean; message: string }>("/account/deletion/cancel", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export function forgotPassword(email: string) {
  return api<{ ok: boolean; message: string }>("/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(email: string, code: string, new_password: string) {
  return api<{ ok: boolean }>("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ email, code, new_password }),
  });
}

// ---------------------------------------------------------------------------
// Reports (complaints)
// ---------------------------------------------------------------------------

export type ReportTargetType = "pujari" | "booking" | "customer";
export type ReportStatus = "open" | "in_review" | "escalated" | "resolved" | "dismissed";

export const REPORT_REASONS: { key: string; label: string }[] = [
  { key: "misconduct", label: "Misconduct or rude behaviour" },
  { key: "no_show", label: "Did not show up" },
  { key: "unsafe", label: "Unsafe behaviour" },
  { key: "fraud", label: "Fraud or scam" },
  { key: "payment", label: "Payment problem" },
  { key: "inappropriate_content", label: "Inappropriate content" },
  { key: "other", label: "Other" },
];

export const REPORT_TARGET_LABELS: Record<string, string> = {
  pujari: "Pujari",
  booking: "Booking",
  customer: "Customer",
};

export const REPORT_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_review: "In review",
  escalated: "Escalated",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export function reportStatusClass(status: string) {
  switch (status) {
    case "open":
      return "bg-blue-50 text-blue-900 border-blue-200";
    case "in_review":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "escalated":
      return "bg-red-50 text-red-900 border-red-200";
    case "resolved":
      return "bg-emerald-50 text-emerald-900 border-emerald-200";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

export const REPORT_DETAILS_MIN = 10;
export const REPORT_DETAILS_MAX = 1000;

export function reportReasonLabel(key: string) {
  return REPORT_REASONS.find((r) => r.key === key)?.label || key;
}

export type MyReport = {
  id: string;
  target_type: ReportTargetType;
  reason: string;
  status: ReportStatus;
  created_at: string;
  resolution: string | null;
};

export function submitReport(body: {
  target_type: ReportTargetType;
  target_id: string;
  booking_id?: string;
  reason: string;
  details: string;
}) {
  return api<{ id: string; status: ReportStatus }>("/reports", { method: "POST", body: JSON.stringify(body) });
}

export function listMyReports() {
  return api<MyReport[]>("/reports/mine");
}
