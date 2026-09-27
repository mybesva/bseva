import { Redirect } from "expo-router";

/** Legacy route — referral details live on the Referral screen. */
export default function PujariRewardsRedirect() {
  return <Redirect href="/pujari/referral" />;
}
