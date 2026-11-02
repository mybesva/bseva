/**
 * English copy for the compliance screens (password reset, account deletion, reports, legal links).
 *
 * Kept here rather than in @bseva/locales because the locale parity test requires every new key to be
 * translated into all seven languages before it can ship. Move these into locales once translations
 * are approved. Server messages (generic OTP replies, deletion status, retention notice) are shown as
 * returned by the API.
 */
import type { DeletionReasonKey, ReportReasonKey } from "@bseva/api-client";
import {
  DELETION_REASON_LABELS_TE,
  REPORT_REASON_LABELS_TE,
  REPORT_STATUS_LABELS_TE,
  REPORT_TARGET_LABELS_TE,
  textTe,
} from "./compliance.te";

// Set by I18nProvider whenever the app language changes. Telugu has its own copy; other languages use English.
let currentLang = "en";
export function setComplianceLang(lang: string): void {
  currentLang = lang;
}

function localized<T extends object>(en: T, te: Partial<Record<keyof T, unknown>>): T {
  return new Proxy(en, {
    get(target, key) {
      if (currentLang === "te" && typeof key === "string" && key in te) return (te as Record<string, unknown>)[key];
      return (target as Record<string | symbol, unknown>)[key];
    },
  });
}

const DELETION_REASON_LABELS_EN: Record<DeletionReasonKey, string> = {
  no_longer_using: "I no longer use B-Seva",
  not_satisfied: "Not satisfied with the service",
  privacy: "Privacy concerns",
  payment_settlement: "Payment or settlement issue",
  app_issues: "Problems with the app",
  duplicate_account: "I have another account",
  other: "Other",
};
export const DELETION_REASON_LABELS = localized(DELETION_REASON_LABELS_EN, DELETION_REASON_LABELS_TE);

const REPORT_REASON_LABELS_EN: Record<ReportReasonKey, string> = {
  misconduct: "Misconduct or rude behaviour",
  no_show: "Did not show up",
  unsafe: "Safety concern",
  fraud: "Fraud or scam",
  payment: "Payment problem",
  inappropriate_content: "Inappropriate content",
  other: "Other",
};
export const REPORT_REASON_LABELS = localized(REPORT_REASON_LABELS_EN, REPORT_REASON_LABELS_TE);

const REPORT_TARGET_LABELS_EN: Record<string, string> = {
  booking: "Booking",
  pujari: "Pujari",
  customer: "Customer",
};
export const REPORT_TARGET_LABELS = localized(REPORT_TARGET_LABELS_EN, REPORT_TARGET_LABELS_TE);

const REPORT_STATUS_LABELS_EN: Record<string, string> = {
  open: "Open",
  in_review: "In review",
  escalated: "Escalated",
  resolved: "Resolved",
  dismissed: "Dismissed",
};
export const REPORT_STATUS_LABELS = localized(REPORT_STATUS_LABELS_EN, REPORT_STATUS_LABELS_TE);

/** Fixed by the API contract; shown after a successful deletion request. */
export const DEACTIVATION_MESSAGE =
  "Your account has been deactivated. Your account deletion request will be completed within 14 days, subject to any legally required retention or unresolved obligations. You will receive confirmation by email.";

export const OTP_RESEND_SECONDS = 60;
export const EXPLANATION_MIN = 10;
export const EXPLANATION_MAX = 500;
export const REPORT_DETAILS_MIN = 10;
export const REPORT_DETAILS_MAX = 1000;
export const PASSWORD_MIN = 8;

const textEn = {
  deactivationMessage: DEACTIVATION_MESSAGE,
  forgotPasswordLink: "Forgot Password?",
  forgotTitle: "Reset Password",
  forgotIntro: "Enter the email address of your B-Seva account. If an account exists, we will email you a 6-digit code.",
  forgotGeneric: "If an account exists for this email, we have sent a code.",
  email: "Email",
  enterEmail: "Enter a valid email address.",
  sendCode: "Send Code",
  sending: "Sending…",
  code: "6-digit code",
  enterCode: "Enter the 6-digit code from the email.",
  resendIn: (s: number) => `Resend code in ${s}s`,
  resendCode: "Resend Code",
  newPassword: "New Password",
  confirmPassword: "Confirm New Password",
  passwordTooShort: `Use at least ${PASSWORD_MIN} characters.`,
  passwordsDontMatch: "The passwords do not match.",
  resetPassword: "Reset Password",
  resetting: "Resetting…",
  invalidCode: "The code is invalid or has expired. Request a new code and try again.",
  resetDone: "Your password has been reset. Sign in with your new password. You have been signed out on all other devices.",
  backToSignIn: "Back to Sign In",
  changeEmail: "Use a different email",
  somethingWrong: "Something went wrong. Please try again.",

  deletionPendingTitle: "Account scheduled for deletion",
  cancelDeletion: "Cancel Deletion",
  cancelTitle: "Cancel Account Deletion",
  cancelIntro: "Enter the email address of the account. If a deletion request is open, we will email you a 6-digit code.",
  cancelGeneric: "If a deletion request exists for this email, we have sent a code.",
  cancelNote: "Bookings that were cancelled when you requested deletion are not restored.",
  confirmCancel: "Cancel My Deletion Request",
  cancelling: "Cancelling…",
  cancelDone: "Your deletion request was cancelled. You can sign in again.",

  legalSection: "Legal",
  accountSection: "Account",
  privacyPolicy: "Privacy Policy",
  customerTerms: "Customer Terms",
  pujariTerms: "Pujari Terms",
  appTerms: "App Terms of Use",
  refundPolicy: "Cancellation & Refund Policy",
  deleteAccountWeb: "Delete Account (web)",
  terms: "Terms",
  loginLegalPrefix: "By signing in you agree to our",
  and: "and",

  changePassword: "Change Password",
  deleteAccount: "Delete Account",
  deleteTitle: "Delete Account",
  deleteWarning:
    "Deleting your account deactivates it now and permanently deletes it after 14 days. You can cancel during those 14 days. After that it cannot be undone.",
  obligationsTitle: "Before you continue",
  noObligations: "You have no open bookings or balances.",
  upcomingBookings: "Upcoming bookings",
  upcomingCustomerNote: "These bookings will be cancelled under the normal Cancellation Policy. Normal fees apply.",
  upcomingPujariNote: "These accepted bookings will be released for reassignment to another pujari.",
  ongoingBookings: "Ongoing bookings",
  ongoingNote: "Ongoing pujas are left to finish.",
  refund: "Refund",
  fee: "Fee",
  cancellationNotAllowed: "Cannot be cancelled now",
  reassign: "Will be reassigned",
  walletBalance: "Wallet balance",
  pendingRefunds: "Pending refunds",
  pendingSettlement: "Pending settlement",
  blockingTitle: "Must be resolved before final deletion",
  retentionTitle: "What we keep",
  existingRequest: "Deletion request",
  reason: "Reason",
  chooseReason: "Choose a reason",
  explanation: "Tell us more",
  explanationHint: `${EXPLANATION_MIN}–${EXPLANATION_MAX} characters`,
  explanationTooShort: `Write at least ${EXPLANATION_MIN} characters.`,
  confirmToggle:
    "I understand that my account will be deactivated now and deleted after 14 days, and that upcoming bookings are handled as shown above.",
  confirmRequired: "Please confirm that you understand.",
  reasonRequired: "Please choose a reason.",
  continue: "Continue",
  codeSentTo: (hint?: string) => (hint ? `We sent a 6-digit code to ${hint}.` : "We sent a 6-digit code to your email."),
  confirmDelete: "Delete My Account",
  deleting: "Deleting…",
  done: "OK",

  report: "Report",
  reportBooking: "Report this booking",
  reportPujari: "Report the pujari",
  reportCustomer: "Report the customer",
  reportTitle: "Report",
  reportIntro: "Tell us what happened. Our team reviews every report. For an emergency, contact local authorities first.",
  details: "Details",
  detailsHint: `${REPORT_DETAILS_MIN}–${REPORT_DETAILS_MAX} characters`,
  detailsTooShort: `Write at least ${REPORT_DETAILS_MIN} characters.`,
  submitReport: "Submit Report",
  submitting: "Submitting…",
  reportSent: "Report submitted. Our team will review it.",
  myReports: "My Reports",
  noReports: "You have not made any reports.",
  resolution: "Resolution",

  walletHelp: "Wallet credit is currently added through B-Seva support. Contact support to add credit to your wallet.",
};

export const text = localized(textEn, textTe);
