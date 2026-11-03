import * as Linking from "expo-linking";
import type { CheckoutSession } from "@bseva/api-client";
import { resolveApiBase } from "@/services/api";

/**
 * Website origin that hosts Cashfree's checkout for the app. Defaults to the API origin (QA and Production
 * serve web and API from one domain); set EXPO_PUBLIC_WEB_URL when they differ.
 */
export function webBaseUrl(): string {
  const explicit = (process.env.EXPO_PUBLIC_WEB_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  return resolveApiBase().replace(/\/api(\/v1)?$/, "");
}

/**
 * Open Cashfree's secure checkout in the phone's browser (UPI apps, cards, net banking). The session id goes in
 * the URL fragment, which browsers never send to a server. When payment ends the website returns to the app via
 * bseva://payment-return; the app then asks the server, which verifies the payment with Cashfree.
 */
export async function openHostedCheckout(bookingId: string, session: CheckoutSession): Promise<void> {
  const fragment = new URLSearchParams({
    booking_id: bookingId,
    sid: session.payment_session_id,
    env: session.environment === "production" ? "production" : "sandbox",
    app: "1",
  }).toString();
  await Linking.openURL(`${webBaseUrl()}/payment/checkout#${fragment}`);
}
