import { Redirect } from "expo-router";

/** My Seva now lives on the bookings screen; old links still land in the right place. */
export default function CustomerMySeva() {
  return <Redirect href="/customer/(tabs)/bookings" />;
}
