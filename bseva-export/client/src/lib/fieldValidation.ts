/** Shared client-side validators mirroring backend/app/validation_rules.py */

const MOBILE_RE = /^(?:\+?91[-\s]?|0)?([6-9]\d{9})$/;
const PIN_RE = /^\d{6}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function normalizeMobile(raw: string): string | null {
  const m = String(raw || "").replace(/\s/g, "").trim().match(MOBILE_RE);
  return m ? m[1] : null;
}

export function isValidMobile(raw: string): boolean {
  return normalizeMobile(raw) != null;
}

export function ageFromDob(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

export function isValidPujariDob(iso: string, minAge = 18): boolean {
  const age = ageFromDob(iso);
  return age != null && age >= minAge && age <= 100;
}

export function isMeaningfulText(raw: string, minLen: number): boolean {
  const s = String(raw || "").trim();
  if (s.length < minLen) return false;
  const alnum = (s.match(/[A-Za-z0-9]/g) || []).length;
  return alnum >= Math.max(1, Math.floor(minLen / 2));
}

export function isValidPincode(raw: string): boolean {
  return PIN_RE.test(String(raw || "").trim());
}

export function isValidIfsc(raw: string): boolean {
  return IFSC_RE.test(String(raw || "").trim().toUpperCase());
}

export function validateAddress(v: {
  address_line1?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isMeaningfulText(v.address_line1 || "", 3)) errors.address_line1 = "Enter a valid address (min 3 characters)";
  if (!isMeaningfulText(v.city || "", 2)) errors.city = "Enter a valid city";
  if (!isMeaningfulText(v.district || "", 2)) errors.district = "Enter a valid district";
  if (!isMeaningfulText(v.state || "", 2)) errors.state = "Enter a valid state";
  if (!isValidPincode(v.pincode || "")) errors.pincode = "PIN code must be exactly 6 digits";
  return errors;
}

export function validateBank(v: { holder?: string; ifsc?: string; last4?: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isMeaningfulText(v.holder || "", 2)) errors.holder = "Account holder name is required";
  if (!isValidIfsc(v.ifsc || "")) errors.ifsc = "Enter a valid IFSC (e.g. SBIN0001234)";
  if (!/^\d{4}$/.test(String(v.last4 || "").trim())) errors.last4 = "Enter exactly 4 account digits";
  return errors;
}

export function validateSupport(subject: string, description: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isMeaningfulText(subject, 5)) errors.subject = "Subject must contain at least 5 meaningful characters";
  if (!isMeaningfulText(description, 10)) errors.description = "Description must contain at least 10 meaningful characters";
  return errors;
}
