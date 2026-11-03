import { Redirect, useLocalSearchParams } from "expo-router";

/** bseva://payment-return?booking_id=… — the website hands the customer back here after Cashfree checkout. */
export default function PaymentReturnLink() {
  const { booking_id } = useLocalSearchParams<{ booking_id?: string }>();
  return <Redirect href={booking_id ? `/customer/payment/${booking_id}` : "/customer"} />;
}
