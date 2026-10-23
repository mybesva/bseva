import { isAdminRole, isCustomerRole, isPujariRole } from "@bseva/config";
import * as Application from "expo-application";

/**
 * Which B-Seva app this binary is. Decided at runtime from the native bundle id, so one JS bundle
 * (and one Metro server in development) serves every variant.
 *
 * - `com.bseva.app`      → "customer"  (B-Seva, the existing store app, now customers only)
 * - `com.bseva.customer` → "customer"  (older test builds)
 * - `com.bseva.pujari`   → "pujari"    (B-Seva Pujari, the new app)
 * - anything else (e.g. Expo Go) → "combined": both roles, for development.
 */
export type AppVariant = "combined" | "customer" | "pujari";

const BUNDLE_VARIANTS: Record<string, AppVariant> = {
  "com.bseva.app": "customer",
  "com.bseva.customer": "customer",
  "com.bseva.pujari": "pujari",
};

export const APP_VARIANT: AppVariant = BUNDLE_VARIANTS[Application.applicationId ?? ""] ?? "combined";

export const isCustomerApp = APP_VARIANT === "customer";
export const isPujariApp = APP_VARIANT === "pujari";
export const isSingleRoleApp = APP_VARIANT !== "combined";

/** The only role this app signs in, or undefined for the combined app. */
export const variantRole: "customer" | "pujari" | undefined = isSingleRoleApp
  ? (APP_VARIANT as "customer" | "pujari")
  : undefined;

/** True when this signed-in role belongs in this app. Admin roles stay on the combined app only. */
export function roleAllowedInApp(role: string): boolean {
  if (APP_VARIANT === "combined") return true;
  if (APP_VARIANT === "customer") return isCustomerRole(role);
  return isPujariRole(role) && !isAdminRole(role);
}

/** Translation key explaining which app the user should use instead. */
export function wrongAppMessageKey(role: string): string {
  if (isPujariRole(role)) return "mw.wrongAppPujari";
  if (isCustomerRole(role)) return "mw.wrongAppCustomer";
  return "mw.wrongAppOther";
}
