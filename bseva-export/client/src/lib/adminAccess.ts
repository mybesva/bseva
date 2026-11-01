/**
 * Back-office access map: which permission(s) open each admin page.
 *
 * Mirrors the backend guards in backend/app/rbac.py and the routers. The backend is the real
 * enforcement; this map only decides what the sidebar shows and which pages render, so an
 * Admin never sees (or loads data for) a module they cannot use.
 */

export type AdminAccess = {
  /** Page opens when the admin holds ANY of these. Empty/undefined = any admin. */
  anyOf?: string[];
  /** Super Admin only, regardless of assigned permissions. */
  superOnly?: boolean;
};

/** Keyed by the path suffix under the private admin base ("" = dashboard). */
export const ADMIN_ROUTE_ACCESS: Record<string, AdminAccess> = {
  "": {},
  "/profile": {},
  "/notifications": {},
  "/customers": { anyOf: ["view_customers"] },
  "/pujaris": { anyOf: ["view_pujaris", "verify_pujaris"] },
  "/head-ratings": { anyOf: ["view_pujaris"] },
  "/temples": { anyOf: ["view_temples", "manage_temples"] },
  "/bulk-import": { anyOf: ["manage_temples"] },
  "/services": { anyOf: ["view_services", "manage_services"] },
  "/recommendations": { anyOf: ["view_recommendations", "manage_recommendations"] },
  "/samagri": { anyOf: ["view_samagri", "manage_samagri"] },
  "/bookings": { anyOf: ["view_bookings", "manage_bookings"] },
  "/virtual-puja": { anyOf: ["view_virtual_puja", "manage_virtual_puja"] },
  "/seva-events": { anyOf: ["view_seva_events", "manage_seva_events"] },
  "/muhurtham": { anyOf: ["view_muhurtham", "manage_muhurtham"] },
  "/invoices": { anyOf: ["view_invoices"] },
  "/payments": { anyOf: ["view_payments"] },
  "/pricing": { anyOf: ["view_pricing", "manage_pricing"] },
  "/reviews": { anyOf: ["view_reviews", "manage_reviews"] },
  "/promos": { anyOf: ["view_promotions", "manage_promotions"] },
  "/support": { anyOf: ["manage_support"] },
  "/legal": { anyOf: ["manage_legal"] },
  // Super Admin only: finance, reporting, platform configuration and admin management.
  "/settlements": { superOnly: true },
  "/tax": { superOnly: true },
  "/security": { superOnly: true },
  "/reports": { superOnly: true },
  "/permissions": { superOnly: true },
  "/settings": { superOnly: true },
  "/email-templates": { superOnly: true },
  "/sms-templates": { superOnly: true },
};

export function canAccess(access: AdminAccess | undefined, isSuper: boolean, permissions: readonly string[]): boolean {
  if (isSuper) return true;
  if (!access) return false; // unknown admin page: deny by default
  if (access.superOnly) return false;
  if (!access.anyOf?.length) return true;
  return access.anyOf.some((p) => permissions.includes(p));
}

/** Resolve the access rule for a location under the admin base (longest matching suffix). */
export function accessForPath(location: string, base: string): AdminAccess | undefined {
  if (!location.startsWith(base)) return undefined;
  const rest = location.slice(base.length).replace(/\/+$/, "");
  if (rest === "") return ADMIN_ROUTE_ACCESS[""];
  const suffixes = Object.keys(ADMIN_ROUTE_ACCESS)
    .filter((s) => s && (rest === s || rest.startsWith(`${s}/`)))
    .sort((a, b) => b.length - a.length);
  return suffixes.length ? ADMIN_ROUTE_ACCESS[suffixes[0]] : undefined;
}
