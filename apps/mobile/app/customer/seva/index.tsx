import { resolveSevaServiceType } from "@bseva/config";
import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Legacy Seva explore route (`/customer/seva?type=`, also used by deep links) now opens the
 * unified Explore Services tab with the matching Seva line selected.
 * `/customer/seva/event/:id` remains the event registration screen.
 */
export default function CustomerSevaExplore() {
  const params = useLocalSearchParams<{ type?: string }>();
  const type = resolveSevaServiceType(params.type);
  return <Redirect href={{ pathname: "/customer/services", params: { type } } as never} />;
}
