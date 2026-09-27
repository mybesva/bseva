import { Redirect } from "expo-router";

/** Legacy route — referral and rewards are combined on the Referral screen. */
export default function CustomerRewardsRedirect() {
  return <Redirect href="/customer/referral" />;
}
