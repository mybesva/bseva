import { api } from "./api";

/** What the API returns to start or resume a gateway checkout (never contains keys). */
export type CheckoutSession = {
  /** Set on online charges (reschedule fee, consultation, Seva registration, paying a later booking date). */
  payment_id?: string;
  provider: string;
  environment: "sandbox" | "production";
  order_id: string;
  payment_session_id: string;
  amount_paise: number;
  currency: string;
  expires_at?: string;
};

export type PaymentStatus = {
  booking_id: string;
  booking_number: string;
  booking_status: string;
  payment_status: string;
  cancel_policy?: string | null;
  paid: boolean;
  payment_expires_at?: string | null;
  total_paise: number;
  attempt?: { provider: string; status: string; attempt_no: number; provider_status?: string | null; message?: string | null } | null;
};

type CashfreeSdk = { checkout: (opts: { paymentSessionId: string; redirectTarget?: string }) => Promise<unknown> };
declare global {
  interface Window {
    Cashfree?: (opts: { mode: "sandbox" | "production" }) => CashfreeSdk;
  }
}

// Cashfree's official browser SDK (the same file @cashfreepayments/cashfree-js loads).
const SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";
let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (window.Cashfree) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        sdkPromise = null;
        reject(new Error("Could not load the secure payment page. Check your connection and try again."));
      };
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

/** Hand the browser to Cashfree. It returns to /payment/return, where the server verifies the result. */
export async function openCashfreeCheckout(session: CheckoutSession): Promise<void> {
  await loadSdk();
  if (!window.Cashfree) throw new Error("Secure payment is unavailable right now.");
  const cashfree = window.Cashfree({ mode: session.environment === "production" ? "production" : "sandbox" });
  await cashfree.checkout({ paymentSessionId: session.payment_session_id, redirectTarget: "_self" });
}

export function paymentConfig() {
  return api<{
    online_enabled: boolean;
    provider: string | null;
    environment: string | null;
    /** False when Super Admin has switched the customer wallet off: customers pay online only. */
    wallet_enabled?: boolean;
  }>("/payments/config");
}

export function resumeCheckout(bookingId: string) {
  return api<CheckoutSession>(`/payments/bookings/${bookingId}/checkout`, { method: "POST" });
}

export function fetchPaymentStatus(bookingId: string) {
  return api<PaymentStatus>(`/payments/bookings/${bookingId}/status`);
}

export function abandonCheckout(bookingId: string) {
  return api<{ ok: boolean }>(`/payments/bookings/${bookingId}/abandon`, { method: "POST" });
}

/** An online charge other than a new booking: reschedule fee, consultation, Seva registration, later booking date. */
export type ChargePurpose = "reschedule_fee" | "consultation" | "seva_registration" | "booking_payment";

export type ChargeStatus = {
  payment_id: string;
  purpose: ChargePurpose;
  status: "paid" | "pending" | "failed" | "closed" | "refunded";
  closed_reason?: "abandoned" | "expired" | null;
  refund_reason?: string | null;
  amount_paise: number;
  reference?: string | null;
  booking_id?: string | null;
  consultation_id?: string | null;
  registration_id?: string | null;
  event_id?: string | null;
  /** Web path to continue to after this payment (e.g. "/booking/<id>"). */
  link?: string | null;
  attempt?: { status: string; attempt_no: number; provider_status?: string | null; message?: string | null } | null;
};

/** What an endpoint returns instead of finishing when the amount due must be paid online first. */
export type ChargeRequired = { payment_required?: boolean; checkout?: CheckoutSession | null };

export function fetchChargeStatus(paymentId: string) {
  return api<ChargeStatus>(`/payments/charges/${encodeURIComponent(paymentId)}/status`);
}

export function resumeChargeCheckout(paymentId: string) {
  return api<CheckoutSession>(`/payments/charges/${encodeURIComponent(paymentId)}/checkout`, { method: "POST" });
}

export function abandonCharge(paymentId: string) {
  return api<{ ok: boolean }>(`/payments/charges/${encodeURIComponent(paymentId)}/abandon`, { method: "POST" });
}

/**
 * If the response asks for an online payment, hand the browser to Cashfree and return true. When the payment page
 * cannot open, send the customer to the return page for that charge, where they can retry or cancel.
 */
export async function startChargeCheckoutIfRequired(
  res: ChargeRequired | null | undefined,
  navigate: (to: string) => void,
): Promise<boolean> {
  if (!res?.payment_required || !res.checkout) return false;
  try {
    await openCashfreeCheckout(res.checkout);
  } catch (e) {
    if (res.checkout.payment_id) navigate(`/payment/return?payment_id=${encodeURIComponent(res.checkout.payment_id)}`);
    throw e;
  }
  return true;
}
