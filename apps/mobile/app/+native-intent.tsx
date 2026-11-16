import { inAppRouteForLink } from "@/utils/webLinks";

/**
 * Website links that open the app (App Links / Universal Links, e.g. "View booking" in WhatsApp) arrive as
 * full https://b-seva.com/... URLs. Map them to the matching app screen: /my-bookings -> customer bookings,
 * /booking/<id> -> customer booking, /pujari/bookings/<id> -> pujari booking. A signed-out user is sent to
 * sign in by the screen's RoleGate. Anything else (bseva:// links, unknown paths) is left to the router.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (/^https?:\/\//i.test(path)) return inAppRouteForLink(path) ?? "/";
    return path;
  } catch {
    return "/";
  }
}
