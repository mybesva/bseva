/** Shared admin QA helpers — validation, filters, chip selection. */

export const ADMIN_BOOKING_STATUS_FILTERS = [
  { id: "", label: "All" },
  { id: "pending_acceptance", label: "Pending acceptance" },
  { id: "confirmed", label: "Confirmed" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "rejected", label: "Rejected" },
] as const;

export const ADMIN_ASSIGNMENT_FILTERS = [
  { id: "", label: "Any assignment" },
  { id: "unassigned", label: "Unassigned" },
  { id: "assigned", label: "Assigned" },
] as const;

export const ADMIN_CUSTOMER_BLOCKED_FILTERS = [
  { id: "", label: "All" },
  { id: "false", label: "Active" },
  { id: "true", label: "Blocked" },
] as const;

export const ADMIN_PAYMENT_STATUS_FILTERS = [
  { id: "", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
  { id: "refunded", label: "Refunded" },
] as const;

/** Treat empty string as a valid single-select chip value (e.g. "All"). */
export function chipSelectionValue(value: string | string[] | undefined | null): Set<string> {
  if (Array.isArray(value)) return new Set(value);
  if (typeof value === "string") return new Set([value]);
  return new Set();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeIndianMobile(raw: string): string | null {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(-10);
  else if (digits.length > 10) digits = digits.slice(-10);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return digits;
}

export function validateAdminCustomerForm(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  location: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  const email = input.email.trim();
  const phone = normalizeIndianMobile(input.phone);
  const password = input.password;
  const location = input.location.trim();

  if (name.length < 2) errors.name = "Enter the customer name.";
  if (!email) errors.email = "Enter a valid email address.";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!phone) errors.phone = "Enter a valid phone number.";
  if (password.length < 8) errors.password = "Password must be at least 8 characters.";
  if (!location) errors.location = "Location is required.";

  return errors;
}

export function validateAdminTempleForm(input: {
  name: string;
  state: string;
  pincode: string;
  deity: string;
  contactPhone: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.name.trim().length < 2) errors.name = "Name is required.";
  if (!input.state.trim()) errors.state = "State is required.";
  if (!/^\d{6}$/.test(input.pincode.trim())) errors.pincode = "Enter a valid 6-digit pincode.";
  if (!input.deity.trim()) errors.deity = "Deity is required.";
  if (!normalizeIndianMobile(input.contactPhone)) errors.contactPhone = "Enter a valid contact phone.";
  return errors;
}

export function validateGstPercent(raw: string): string | null {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0 || n > 100) return "Enter a GST percentage between 0 and 100.";
  return null;
}

export function filterPujariRoles<T extends { level?: number; title?: string; summary?: string; examples?: string[] }>(
  rows: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((role) => {
    const hay = [
      role.title,
      role.summary,
      role.level != null ? `level ${role.level}` : "",
      ...(role.examples || []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function filterServiceCategories<T extends { name?: string; slug?: string; description?: string }>(
  rows: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((c) => {
    const hay = `${c.name || ""} ${c.slug || ""} ${c.description || ""}`.toLowerCase();
    return hay.includes(q);
  });
}

export function matchesServiceSearch(
  service: { name?: string; slug?: string; search_aliases?: string[]; search_aliases_text?: string },
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const aliases = Array.isArray(service.search_aliases)
    ? service.search_aliases.join(" ")
    : String(service.search_aliases_text || "");
  const hay = `${service.name || ""} ${service.slug || ""} ${aliases}`.toLowerCase();
  return hay.includes(q);
}
