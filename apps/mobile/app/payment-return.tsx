import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * bseva://payment-return?booking_id=… (new booking) or ?payment_id=… (online charge) — the website hands the
 * customer back here after Cashfree checkout.
 */
export default function PaymentReturnLink() {
  const { booking_id, payment_id } = useLocalSearchParams<{ booking_id?: string; payment_id?: string }>();
  if (payment_id) return <Redirect href={`/customer/payment/charge/${payment_id}`} />;
  return <Redirect href={booking_id ? `/customer/payment/${booking_id}` : "/customer"} />;
}
